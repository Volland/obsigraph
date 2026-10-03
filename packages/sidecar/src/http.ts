import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { BuiltinEngine, CypherError, resultToJson } from '@obsigraph/core';
import type { Config } from './config.js';
import { BackendUnavailable, type LadybugBackend } from './ladybug/backend.js';
import { EmbeddingError } from '@obsigraph/core';
import type { VectorIndex } from './vectors/vector-index.js';
import type { VaultSync } from './sync.js';

export type Logger = (msg: string) => void;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly kind: string,
    message: string,
  ) {
    super(message);
  }
}

/** Constant-time token check over fixed-length digests. */
export function tokenMatches(expected: string, header: string | undefined): boolean {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? '');
  if (!m) return false;
  const a = createHash('sha256').update(m[1]!.trim()).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Replace any occurrence of the token in log output. */
export function redactor(token: string | null): (s: string) => string {
  return token ? (s) => s.split(token).join('***') : (s) => s;
}

async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > limit) throw new HttpError(413, 'too_large', `Request body exceeds ${limit} bytes`);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, 'too_large', `Request body exceeds ${limit} bytes`);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(json);
}

/**
 * REST surface: `GET /health` (open), `GET /status` and `POST /query`
 * (bearer token). Errors are JSON without stack traces.
 */
// @lat: [[sidecar#Interfaces]]
export interface ApiExtras {
  mirrorStatus?: () => unknown;
  /** Ladybug query backend, or the reason it is unavailable. */
  ladybug?: () => LadybugBackend | string;
  vectors?: () => VectorIndex | null;
}

export function createApi(config: Config, sync: VaultSync, log: Logger = () => {}, extras: ApiExtras = {}): Server {
  const engine = new BuiltinEngine(sync.graph, () => ({ maxPathDepth: config.maxPathDepth, timeoutMs: config.queryTimeoutMs }));
  const redact = redactor(config.token);

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = `${req.method} ${url.pathname}`;

    if (url.pathname === '/health') {
      if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed', 'Use GET');
      return send(res, 200, { status: 'ok' });
    }
    if (config.token && !tokenMatches(config.token, req.headers.authorization)) {
      throw new HttpError(401, 'unauthorized', 'Missing or invalid bearer token');
    }

    switch (route) {
      case 'GET /status': {
        const s = sync.status();
        return send(res, 200, {
          state: s.state,
          notes: s.notes,
          edges: s.edges,
          pending: s.pending,
          lastSync: s.lastSync,
          frontmatterErrors: sync.frontmatterErrors.size,
          mirror: extras.mirrorStatus?.() ?? null,
          vectors: extras.vectors?.()?.status() ?? null,
          embeddingModel: extras.vectors?.()?.status().identity ?? null,
        });
      }
      case 'POST /query': {
        const raw = await readBody(req, config.maxBodyBytes);
        let body: { query?: unknown; params?: unknown; backend?: unknown };
        try {
          body = JSON.parse(raw);
        } catch {
          throw new HttpError(400, 'bad_request', 'Body must be JSON: {"query": "...", "params": {}}');
        }
        if (typeof body.query !== 'string' || !body.query.trim()) throw new HttpError(400, 'bad_request', '"query" must be a non-empty string');
        const params = body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? (body.params as Record<string, unknown>) : {};
        const backend = body.backend ?? 'builtin';
        if (backend === 'builtin') return send(res, 200, resultToJson(engine.run(body.query, params)));
        if (backend !== 'ladybug') throw new HttpError(400, 'bad_request', '"backend" must be "builtin" or "ladybug"');
        // @lat: [[ladybug-mirror#Hosted by the sidecar]]
        const lb = extras.ladybug?.() ?? 'The Ladybug backend is not configured on this sidecar';
        if (typeof lb === 'string') throw new BackendUnavailable('unavailable', lb);
        return send(res, 200, await lb.run(body.query, params));
      }
      case 'POST /search':
        return send(res, 200, await search(await readBody(req, config.maxBodyBytes)));
      case 'POST /vectors/rebuild': {
        const v = extras.vectors?.();
        if (!v) throw new BackendUnavailable('unavailable', 'The vector index is disabled (OBSIGRAPH_VECTORS=0)');
        await v.rebuild();
        return send(res, 200, v.status());
      }
      default:
        if (['/status', '/query', '/search', '/vectors/rebuild'].includes(url.pathname)) throw new HttpError(405, 'method_not_allowed', `${req.method} not allowed on ${url.pathname}`);
        throw new HttpError(404, 'not_found', `No route ${url.pathname}`);
    }
  };

  /**
   * Vector search over nodes or edges, optionally followed by a Cypher query
   * that receives the hit ids as `$hits` (search then traverse).
   */
  // @lat: [[vector-search#Vector index]]
  const search = async (raw: string) => {
    let body: { query?: unknown; target?: unknown; k?: unknown; types?: unknown; mode?: unknown; then?: unknown; backend?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'bad_request', 'Body must be JSON: {"query": "...", "target": "nodes", "k": 5}');
    }
    if (typeof body.query !== 'string' || !body.query.trim()) throw new HttpError(400, 'bad_request', '"query" must be a non-empty string');
    const target = body.target ?? 'nodes';
    if (target !== 'nodes' && target !== 'edges') throw new HttpError(400, 'bad_request', '"target" must be "nodes" or "edges"');
    const k = body.k === undefined ? 5 : Number(body.k);
    if (!Number.isInteger(k) || k < 1 || k > 100) throw new HttpError(400, 'bad_request', '"k" must be an integer from 1 to 100');
    const types = Array.isArray(body.types) ? body.types.map(String) : undefined;
    const mode = body.mode === 'pooled' ? 'pooled' : 'best';
    const v = extras.vectors?.();
    if (!v) throw new BackendUnavailable('unavailable', 'The vector index is disabled (OBSIGRAPH_VECTORS=0)');
    const st = v.status();
    let results;
    try {
      results = target === 'nodes' ? await v.searchNodes(body.query, k, { types, mode }) : await v.searchEdges(body.query, k);
    } catch (e) {
      if (e instanceof EmbeddingError) throw new BackendUnavailable('unavailable', `Vector search is degraded: ${e.message}`);
      throw e;
    }
    const notices: string[] = [];
    if (st.state === 'mismatch') notices.push(`Results come from a stale index: ${st.message}`);
    if (st.pending > 0) notices.push(`${st.pending} note(s) are waiting to be embedded; results may be incomplete.`);
    let then: unknown;
    if (typeof body.then === 'string' && body.then.trim()) {
      const params = { hits: results.map((r) => r.id) };
      if ((body.backend ?? 'builtin') === 'ladybug') {
        const lb = extras.ladybug?.() ?? 'The Ladybug backend is not configured on this sidecar';
        if (typeof lb === 'string') throw new BackendUnavailable('unavailable', lb);
        then = await lb.run(body.then, params);
      } else {
        then = resultToJson(engine.run(body.then, params));
      }
    }
    return { target, stale: st.state === 'mismatch', results, ...(then ? { then } : {}), ...(notices.length ? { notices } : {}) };
  };

  return createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      if (err instanceof HttpError) return send(res, err.status, { error: { kind: err.kind, message: err.message } });
      if (err instanceof BackendUnavailable) return send(res, 503, { error: { kind: err.kind, message: err.message } });
      if (err instanceof CypherError) {
        const status = err.kind === 'timeout' ? 504 : 400;
        return send(res, status, { error: { kind: err.kind, message: err.message, line: err.line, column: err.column } });
      }
      log(redact(`internal error on ${req.method} ${req.url}: ${(err as Error)?.message ?? String(err)}`));
      return send(res, 500, { error: { kind: 'internal', message: 'Internal error' } });
    });
  });
}
