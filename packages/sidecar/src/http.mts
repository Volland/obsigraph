import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { CypherError } from '@obsigraph/core';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Config } from './config.mjs';
import { BackendUnavailable } from './ladybug/backend.mjs';
import { createMcpServer } from './mcp/server.mjs';
import { InputError, type Ops } from './ops.mjs';
import type { VectorIndex } from './vectors/vector-index.mjs';
import type { VaultSync } from './sync.mjs';

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
  vectors?: () => VectorIndex | null;
}

function parse(raw: string, hint: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new HttpError(400, 'bad_request', `Body must be a JSON object: ${hint}`);
}

/**
 * REST and MCP surface: `GET /health` (open), `GET /status`, `POST /query`,
 * `POST /search`, `POST /retrieve`, `POST /vectors/rebuild` and `POST /mcp`
 * (streamable HTTP, stateless). Everything but health needs the bearer token.
 */
// @lat: [[sidecar#Interfaces]]
export function createApi(config: Config, sync: VaultSync, log: Logger = () => {}, extras: ApiExtras = {}, ops?: Ops): Server {
  const redact = redactor(config.token);
  if (!ops) throw new Error('createApi needs the shared operations');

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
      case 'POST /query':
        // @lat: [[ladybug-mirror#Hosted by the sidecar]]
        return send(res, 200, await ops.cypher(parse(await readBody(req, config.maxBodyBytes), '{"query": "...", "params": {}}')));
      case 'POST /search':
        return send(res, 200, await ops.search(parse(await readBody(req, config.maxBodyBytes), '{"query": "...", "target": "nodes", "k": 5}')));
      case 'POST /retrieve':
        return send(res, 200, await ops.retrieve(parse(await readBody(req, config.maxBodyBytes), '{"question": "...", "k": 5, "depth": 1}')));
      case 'POST /vectors/rebuild': {
        const v = extras.vectors?.();
        if (!v) throw new BackendUnavailable('unavailable', 'The vector index is disabled (OBSIGRAPH_VECTORS=0)');
        await v.rebuild();
        return send(res, 200, v.status());
      }
      case 'POST /mcp': {
        const body = parse(await readBody(req, config.maxBodyBytes), 'a JSON-RPC message');
        const server = createMcpServer(ops);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.on('close', () => {
          void transport.close();
          void server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }
      default:
        if (['/status', '/query', '/search', '/retrieve', '/vectors/rebuild', '/mcp'].includes(url.pathname)) {
          throw new HttpError(405, 'method_not_allowed', `${req.method} not allowed on ${url.pathname}`);
        }
        throw new HttpError(404, 'not_found', `No route ${url.pathname}`);
    }
  };

  return createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      if (res.headersSent) return;
      if (err instanceof HttpError) return send(res, err.status, { error: { kind: err.kind, message: err.message } });
      if (err instanceof InputError) return send(res, 400, { error: { kind: 'bad_request', message: err.message } });
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
