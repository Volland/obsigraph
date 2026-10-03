import type { Server } from 'node:http';
import { ConfigError, isLoopback, loadConfig, type Config } from './config.js';
import { DataDir } from './data-dir.js';
import { createApi, redactor, type Logger } from './http.js';
import { VaultSync, type Processor } from './sync.js';

export interface Sidecar {
  config: Config;
  sync: VaultSync;
  server: Server;
  /** Bound port (useful when configured as 0). */
  port: number;
  stop(): Promise<void>;
}

/** Start sync and the HTTP API; resolves once the initial sync finished and the server listens. */
// @lat: [[sidecar]]
export async function startSidecar(env: NodeJS.ProcessEnv = process.env, processors: Processor[] = [], log: Logger = console.error): Promise<Sidecar> {
  const config = loadConfig(env);
  const redact = redactor(config.token);
  const sync = new VaultSync(config.vaultDir, new DataDir(config.dataDir, config.vaultDir), processors, {
    debounceMs: config.debounceMs,
    pollMs: config.pollMs,
  });
  await sync.start();
  sync.watch();

  const server = createApi(config, sync, log);
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
    async stop() {
      await new Promise<void>((r) => server.close(() => r()));
      await sync.stop();
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
