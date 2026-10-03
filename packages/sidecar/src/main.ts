import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { providerFromEnv, type EmbeddingProvider } from '@obsigraph/core';
import { ConfigError, isLoopback, loadConfig, type Config } from './config.js';
import { DataDir } from './data-dir.js';
import { createApi, redactor, type Logger } from './http.js';
import { LadybugBackend } from './ladybug/backend.js';
import { LadybugMirror, type MirrorStatus } from './mirror/mirror.js';
import { LadybugStore, loadLadybug, type MirrorStore } from './mirror/store.js';
import { VaultSync, type Processor } from './sync.js';
import { VectorIndex } from './vectors/vector-index.js';

export interface Sidecar {
  config: Config;
  sync: VaultSync;
  server: Server;
  /** Bound port (useful when configured as 0). */
  port: number;
  mirror: LadybugMirror | null;
  vectors: VectorIndex | null;
  stop(): Promise<void>;
}

export interface StartOptions {
  processors?: Processor[];
  log?: Logger;
  /** Override the mirror store (tests); defaults to LadybugDB when installed. */
  mirrorStore?: (data: DataDir) => Promise<MirrorStore>;
  /** Override the native module loader (tests). */
  loadLadybug?: typeof loadLadybug;
  /** Override the embedding provider (tests); defaults to OBSIGRAPH_EMBED_* settings. */
  embedder?: EmbeddingProvider;
}

/** Start sync and the HTTP API; resolves once the initial sync finished and the server listens. */
// @lat: [[sidecar]]
export async function startSidecar(env: NodeJS.ProcessEnv = process.env, opts: StartOptions | Processor[] = {}, legacyLog?: Logger): Promise<Sidecar> {
  const o: StartOptions = Array.isArray(opts) ? { processors: opts, log: legacyLog } : opts;
  const processors = [...(o.processors ?? [])];
  const log = o.log ?? legacyLog ?? console.error;
  const config = loadConfig(env);
  const redact = redactor(config.token);
  const data = new DataDir(config.dataDir, config.vaultDir);

  // @lat: [[ladybug-mirror#Hosted by the sidecar]]
  let mirror: LadybugMirror | null = null;
  let mirrorUnavailable: string | null = config.ladybug ? null : 'disabled by OBSIGRAPH_LADYBUG=0';
  if (config.ladybug) {
    let store: MirrorStore | null = null;
    if (o.mirrorStore) store = await o.mirrorStore(data);
    else {
      const loaded = await (o.loadLadybug ?? loadLadybug)();
      if ('error' in loaded) mirrorUnavailable = `LadybugDB unavailable: ${loaded.error}`;
      else {
        const s = new LadybugStore(loaded.lbug, data);
        await s.open();
        store = s;
      }
    }
    if (store) {
      mirror = new LadybugMirror(store, data);
      await mirror.open();
      processors.push(mirror);
    }
  }

  // @lat: [[vector-search#Vector index]]
  let vectors: VectorIndex | null = null;
  if (config.vectors) {
    const provider = o.embedder ?? providerFromEnv(env, (f) => readFileSync(f, 'utf8'));
    vectors = new VectorIndex(provider, data, { hashOf: (p) => sync.contentHash(p), read: (p) => sync.readText(p) }, { retryMs: config.embedRetryMs });
    await vectors.open();
    processors.push(vectors);
  }

  const sync = new VaultSync(config.vaultDir, data, processors, {
    debounceMs: config.debounceMs,
    pollMs: config.pollMs,
  });
  await sync.start();
  sync.watch();
  mirror?.attach(sync.graph);
  vectors?.attach(sync.graph);

  const mirrorStatus = (): MirrorStatus | { state: 'disabled' | 'unavailable'; message: string } =>
    mirror ? mirror.status() : { state: config.ladybug ? 'unavailable' : 'disabled', message: mirrorUnavailable ?? '' };
  const backend = mirror && mirror.store instanceof LadybugStore
    ? new LadybugBackend(mirror.store, mirror, sync, { maxPathDepth: config.maxPathDepth, timeoutMs: config.queryTimeoutMs })
    : null;
  const ladybug = () => backend ?? (mirrorUnavailable ?? 'The Ladybug mirror is not running');
  const server = createApi(config, sync, log, { mirrorStatus, ladybug, vectors: () => vectors });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  if (!isLoopback(config.host) && !config.behindTlsProxy) {
    log(`WARNING: listening on ${config.host}:${port} without TLS; traffic is unencrypted unless a TLS proxy is in front (set OBSIGRAPH_BEHIND_TLS_PROXY=1 once it is).`);
  }
  if (!config.token) log('WARNING: running without authentication (OBSIGRAPH_ALLOW_NO_AUTH=1); loopback only.');
  const s = sync.status();
  log(redact(`obsigraph sidecar on ${config.host}:${port} — ${s.notes} notes, ${s.edges} edges`));

  return {
    config,
    sync,
    server,
    port,
    mirror,
    vectors,
    async stop() {
      vectors?.stop();
      await new Promise<void>((r) => server.close(() => r()));
      await sync.stop();
      await mirror?.idle();
      await vectors?.idle();
      backend?.close();
      await mirror?.store.close();
    },
  };
}

const isEntry = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isEntry) {
  startSidecar().then(
    (sc) => {
      const shutdown = () => void sc.stop().then(() => process.exit(0));
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    },
    (err: unknown) => {
      console.error(err instanceof ConfigError ? `Configuration error: ${err.message}` : `Failed to start: ${(err as Error).message}`);
      process.exit(1);
    },
  );
}
