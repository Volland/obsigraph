import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_MAX_PATH_DEPTH, DEFAULT_SCHEMA_FOLDER } from '@obsigraph/core';

export interface Config {
  vaultDir: string;
  dataDir: string;
  /** Null only when the unauthenticated override is set. */
  token: string | null;
  host: string;
  port: number;
  behindTlsProxy: boolean;
  debounceMs: number;
  /** 0 disables polling. */
  pollMs: number;
  queryTimeoutMs: number;
  maxBodyBytes: number;
  maxPathDepth: number;
  schemaFolder: string;
  /** Mirror the graph into LadybugDB (when the module is installed). */
  ladybug: boolean;
}

export class ConfigError extends Error {}

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

export function isLoopback(host: string): boolean {
  return LOOPBACK.has(host);
}

function int(env: NodeJS.ProcessEnv, name: string, fallback: number, min = 0): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) throw new ConfigError(`${name} must be an integer >= ${min}, got '${raw}'`);
  return n;
}

/**
 * Read configuration from the environment and validate the directories:
 * the vault must be readable, the data directory must exist and be writable.
 */
// @lat: [[sidecar#Security]]
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const vaultDir = resolve(env.OBSIGRAPH_VAULT ?? '/vault');
  const dataDir = resolve(env.OBSIGRAPH_DATA ?? '/data');

  try {
    if (!statSync(vaultDir).isDirectory()) throw new Error();
    accessSync(vaultDir, constants.R_OK);
  } catch {
    throw new ConfigError(`Vault directory ${vaultDir} is missing or unreadable (set OBSIGRAPH_VAULT)`);
  }
  try {
    if (!statSync(dataDir).isDirectory()) throw new Error();
    accessSync(dataDir, constants.W_OK);
  } catch {
    throw new ConfigError(`Data directory ${dataDir} is missing or not writable (set OBSIGRAPH_DATA to a writable volume)`);
  }
  if (dataDir === vaultDir || dataDir.startsWith(`${vaultDir}/`)) {
    throw new ConfigError(`Data directory ${dataDir} must be outside the vault ${vaultDir}`);
  }

  let token = env.OBSIGRAPH_TOKEN?.trim() || null;
  if (!token && env.OBSIGRAPH_TOKEN_FILE) {
    try {
      token = readFileSync(env.OBSIGRAPH_TOKEN_FILE, 'utf8').trim() || null;
    } catch {
      throw new ConfigError(`Cannot read token file ${env.OBSIGRAPH_TOKEN_FILE}`);
    }
  }
  if (!token && env.OBSIGRAPH_ALLOW_NO_AUTH !== '1') {
    throw new ConfigError('No token configured: set OBSIGRAPH_TOKEN or OBSIGRAPH_TOKEN_FILE (or OBSIGRAPH_ALLOW_NO_AUTH=1 for local testing)');
  }

  const host = env.OBSIGRAPH_HOST?.trim() || '127.0.0.1';
  if (!token && !isLoopback(host)) {
    throw new ConfigError('Refusing to run without a token on a non-loopback address');
  }

  return {
    vaultDir,
    dataDir,
    token,
    host,
    port: int(env, 'OBSIGRAPH_PORT', 8765),
    behindTlsProxy: env.OBSIGRAPH_BEHIND_TLS_PROXY === '1',
    debounceMs: int(env, 'OBSIGRAPH_DEBOUNCE_MS', 300),
    pollMs: int(env, 'OBSIGRAPH_POLL_MS', 0),
    queryTimeoutMs: int(env, 'OBSIGRAPH_QUERY_TIMEOUT_MS', 5000, 1),
    maxBodyBytes: int(env, 'OBSIGRAPH_MAX_BODY_BYTES', 64 * 1024, 1),
    maxPathDepth: int(env, 'OBSIGRAPH_MAX_PATH_DEPTH', DEFAULT_MAX_PATH_DEPTH, 1),
    schemaFolder: env.OBSIGRAPH_SCHEMA_FOLDER ?? DEFAULT_SCHEMA_FOLDER,
    ladybug: env.OBSIGRAPH_LADYBUG !== '0',
  };
}
