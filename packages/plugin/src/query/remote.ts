import { resultFromJson, type JsonQueryResult, type QueryResult } from '@obsigraph/core';

export interface RemoteConfig {
  url: string;
  token: string;
}

export type Fetcher = (req: { url: string; method: 'POST'; headers: Record<string, string>; body: string }) => Promise<{ status: number; json: unknown }>;

export type RemoteOutcome =
  | { kind: 'result'; result: QueryResult }
  | { kind: 'error'; message: string; line: number; column: number }
  | { kind: 'retry'; message: string; afterMs: number };

const err = (message: string, line = 0, column = 0): RemoteOutcome => ({ kind: 'error', message, line, column });

/**
 * Run a query on the sidecar's Ladybug backend and turn every response into
 * something a block can show: a result, a positioned error, or "retry later"
 * while the mirror is still building.
 */
// @lat: [[ladybug-mirror#Hosted by the sidecar]]
export async function runRemote(fetcher: Fetcher, cfg: RemoteConfig, query: string, params: Record<string, unknown> = {}): Promise<RemoteOutcome> {
  const url = cfg.url.trim().replace(/\/+$/, '');
  if (!url) return err('Ladybug queries run in the Obsigraph sidecar. Set the sidecar URL and token in Obsigraph settings.');
  let res: { status: number; json: unknown };
  try {
    res = await fetcher({
      url: `${url}/query`,
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cfg.token ? { authorization: `Bearer ${cfg.token}` } : {}) },
      body: JSON.stringify({ query, params, backend: 'ladybug' }),
    });
  } catch (e) {
    return err(`Cannot reach the Obsigraph sidecar at ${url}: ${(e as Error).message}`);
  }
  const body = (res.json ?? {}) as { error?: { kind?: string; message?: string; line?: number; column?: number } };
  if (res.status === 200) return { kind: 'result', result: resultFromJson(res.json as JsonQueryResult) };
  if (res.status === 401) return err('The sidecar rejected the token; check the sidecar token in Obsigraph settings.');
  const e = body.error ?? {};
  if (res.status === 503 && e.kind === 'not_ready') return { kind: 'retry', message: e.message ?? 'The Ladybug mirror is not ready yet.', afterMs: 3000 };
  if (res.status === 503) {
    return err(`Ladybug is not available on the sidecar: ${e.message ?? 'unknown reason'}. Install @ladybugdb/core where the sidecar runs and keep OBSIGRAPH_LADYBUG enabled.`);
  }
  if (e.message) return err(e.message, e.line ?? 0, e.column ?? 0);
  return err(`The sidecar answered with HTTP ${res.status}.`);
}
