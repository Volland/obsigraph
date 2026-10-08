import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { providerFromEnv, type EmbeddingProvider } from './vectors/provider.mjs';
import { ConfigError, isLoopback, loadConfig, type Config } from './config.mjs';
import { DataDir } from './data-dir.mjs';
import { createApi, redactor, type Logger } from './http.mjs';
import { Ops } from './ops.mjs';
import { createMcpServer } from './mcp/server.mjs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LadybugBackend } from './ladybug/backend.mjs';
import { LadybugMirror, type MirrorStatus } from './mirror/mirror.mjs';
import { LadybugStore, loadLadybug, type MirrorStore } from './mirror/store.mjs';
import { VaultSync, type Processor } from './sync.mjs';
import { VectorIndex } from './vectors/vector-index.mjs';

export interface Sidecar {
  config: Config;
  sync: VaultSync;
  /** Null in stdio mode, which has no HTTP listener. */
  server: Server | null;
  ops: Ops;
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
  /** Serve MCP over stdio only: no HTTP listener and no token. */
  stdio?: boolean;
}

/** Start sync and the HTTP API; resolves once the initial sync finished and the server listens. */
// @lat: [[sidecar]]
// @tg: implements:: [[openspec:ladybug-mirror#Mirror is optional]]
// @tg: implements:: [[openspec:sidecar-service#Safe default network binding]]
export async function startSidecar(env: NodeJS.ProcessEnv = process.env, opts: StartOptions | Processor[] = {}, legacyLog?: Logger): Promise<Sidecar> {
  const o: StartOptions = Array.isArray(opts) ? { processors: opts, log: legacyLog } : opts;
  const processors = [...(o.processors ?? [])];
  const log = o.log ?? legacyLog ?? console.error;
  const config = loadConfig(env, { requireToken: !o.stdio });
  const redact = redactor(config.token);
  const data = new DataDir(config.dataDir, config.vaultDir);

  // @lat: [[ladybug-mirror#Hosted by the sidecar]]
  let mirror: LadybugMirror | null = null;
  let mirrorUnavailable: string | null = config.ladybug ? null : 'disabled by OBSIGRAPH_LADYBUG=0';
  if (config.ladybug) {
    const opened = await openMirror(o, data, log);
    if (typeof opened === 'string') mirrorUnavailable = opened;
    else {
      mirror = opened;
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
    linkEdges: config.linkEdges,
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
  const ops = new Ops({ config, graph: sync.graph, ladybug, vectors: () => vectors });
  let server: Server | null = null;
  let port = 0;
  if (!o.stdio) {
    const srv = createApi(config, sync, log, { mirrorStatus, vectors: () => vectors }, ops);
    server = srv;
    await new Promise<void>((resolve, reject) => {
      srv.once('error', reject);
      srv.listen(config.port, config.host, () => resolve());
    });
    const address = srv.address();
    port = typeof address === 'object' && address ? address.port : config.port;
  }
  if (server && !isLoopback(config.host) && !config.behindTlsProxy) {
    log(`WARNING: listening on ${config.host}:${port} without TLS; traffic is unencrypted unless a TLS proxy is in front (set OBSIGRAPH_BEHIND_TLS_PROXY=1 once it is).`);
  }
  if (server && !config.token) log('WARNING: running without authentication (OBSIGRAPH_ALLOW_NO_AUTH=1); loopback only.');
  const s = sync.status();
  log(redact(`typed-graph sidecar ${server ? `on ${config.host}:${port}` : 'on stdio'} — ${s.notes} notes, ${s.edges} edges`));

  return {
    config,
    sync,
    server,
    ops,
    port,
    mirror,
    vectors,
    async stop() {
      vectors?.stop();
      const srv = server;
      if (srv) await new Promise<void>((r) => srv.close(() => r()));
      await sync.stop();
      await mirror?.idle();
      await vectors?.idle();
      backend?.close();
      await mirror?.store.close();
    },
  };
}

const firstLine = (e: unknown) => (e instanceof Error ? e.message : String(e)).split('\n')[0]!;

/**
 * Open the mirror store and the mirror. A database that fails to open is
 * discarded and rebuilt once; when that fails too, or the store cannot be
 * created at all, the reason is returned and the sidecar runs without the mirror.
 */
// @lat: [[ladybug-mirror#Hosted by the sidecar]]
// @tg: implements:: [[openspec:ladybug-mirror#Mirror is optional]]
// @tg: implements:: [[openspec:ladybug-mirror#Stale or incompatible mirror is rebuilt]]
async function openMirror(o: StartOptions, data: DataDir, log: Logger): Promise<LadybugMirror | string> {
  let store: MirrorStore;
  try {
    if (o.mirrorStore) store = await o.mirrorStore(data);
    else {
      const loaded = await (o.loadLadybug ?? loadLadybug)();
      if ('error' in loaded) return `LadybugDB unavailable: ${loaded.error}`;
      store = new LadybugStore(loaded.lbug, data);
    }
  } catch (e) {
    log(`The Ladybug mirror store could not be created: ${firstLine(e)}`);
    return `The Ladybug mirror could not be opened: ${firstLine(e)}`;
  }
  try {
    if (store instanceof LadybugStore) await store.open();
    const mirror = new LadybugMirror(store, data);
    await mirror.open();
    return mirror;
  } catch (e) {
    log(`The Ladybug mirror could not be opened (${firstLine(e)}); discarding and rebuilding it.`);
  }
  try {
    if (store instanceof LadybugStore) {
      // The failed handle cannot even close cleanly: drop it with the files.
      await store.close().catch(() => {});
      await rm(store.path, { recursive: true, force: true });
      await rm(`${store.path}.wal`, { force: true });
      const fresh = new LadybugStore(store.lbug, data);
      await fresh.open();
      store = fresh;
    }
    const mirror = new LadybugMirror(store, data);
    await mirror.rebuild();
    return mirror;
  } catch (e) {
    await store.close().catch(() => {});
    log(`The Ladybug mirror could not be rebuilt: ${firstLine(e)}`);
    return `The Ladybug mirror could not be opened: ${firstLine(e)}`;
  }
}

const isEntry = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isEntry) {
  const stdio = process.argv.includes('--stdio');
  startSidecar(process.env, { stdio }).then(
    async (sc) => {
      // @lat: [[sidecar#Interfaces]]
      if (stdio) await createMcpServer(sc.ops).connect(new StdioServerTransport());
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
