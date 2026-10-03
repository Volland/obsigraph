import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { BuiltinEngine, CypherError, resultToJson } from '@obsigraph/core';
import type { Config } from './config.js';
import { BackendUnavailable, type LadybugBackend } from './ladybug/backend.js';
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
          vectors: null,
          embeddingModel: null,
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
      default:
        if (['/status', '/query'].includes(url.pathname)) throw new HttpError(405, 'method_not_allowed', `${req.method} not allowed on ${url.pathname}`);
        throw new HttpError(404, 'not_found', `No route ${url.pathname}`);
    }
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
