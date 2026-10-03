import { BuiltinEngine, resultToJson, type Graph, type JsonQueryResult } from '@obsigraph/core';
import { EmbeddingError } from './vectors/provider.mjs';
import type { Config } from './config.mjs';
import { BackendUnavailable, type LadybugBackend } from './ladybug/backend.mjs';
import { retrieve, type RetrieveResult } from './rag/retrieve.mjs';
import type { VectorIndex } from './vectors/vector-index.mjs';

/** Bad input from a client; maps to HTTP 400 or an MCP tool error. */
export class InputError extends Error {}

export interface OpsDeps {
  config: Config;
  graph: Graph;
  ladybug: () => LadybugBackend | string;
  vectors: () => VectorIndex | null;
}

type Obj = Record<string, unknown>;

const str = (o: Obj, k: string, required = true): string | undefined => {
  const v = o[k];
  if (v === undefined && !required) return undefined;
  if (typeof v !== 'string' || !v.trim()) throw new InputError(`"${k}" must be a non-empty string`);
  return v;
};

const int = (o: Obj, k: string, def: number, min: number, max: number): number => {
  const v = o[k] === undefined ? def : Number(o[k]);
  if (!Number.isInteger(v) || v < min || v > max) throw new InputError(`"${k}" must be an integer from ${min} to ${max}`);
  return v;
};

/**
 * The read-only operations behind both REST and MCP, so both surfaces give
 * identical results: Cypher on either backend, vector search, GraphRAG retrieve.
 */
// @lat: [[sidecar#Interfaces]]
export class Ops {
  readonly engine: BuiltinEngine;

  constructor(private readonly d: OpsDeps) {
    this.engine = new BuiltinEngine(d.graph, () => ({ maxPathDepth: d.config.maxPathDepth, timeoutMs: d.config.queryTimeoutMs }));
  }

  async cypher(input: Obj): Promise<JsonQueryResult> {
    const query = str(input, 'query')!;
    const params = input.params && typeof input.params === 'object' && !Array.isArray(input.params) ? (input.params as Obj) : {};
    return this.run(query, params, input.backend);
  }

  private async run(query: string, params: Obj, backend: unknown = 'builtin'): Promise<JsonQueryResult> {
    if (backend === undefined || backend === 'builtin') return resultToJson(this.engine.run(query, params));
    if (backend !== 'ladybug') throw new InputError('"backend" must be "builtin" or "ladybug"');
    const lb = this.d.ladybug();
    if (typeof lb === 'string') throw new BackendUnavailable('unavailable', lb);
    return lb.run(query, params);
  }

  private index(): VectorIndex {
    const v = this.d.vectors();
    if (!v) throw new BackendUnavailable('unavailable', 'The vector index is disabled (OBSIGRAPH_VECTORS=0)');
    return v;
  }

  private async embedding<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof EmbeddingError) throw new BackendUnavailable('unavailable', `Embeddings are unavailable: ${e.message}`);
      throw e;
    }
  }

  /** Vector search over nodes or edges, optionally followed by Cypher with `$hits`. */
  // @lat: [[vector-search#Vector index]]
  async search(input: Obj) {
    const query = str(input, 'query')!;
    const target = input.target ?? 'nodes';
    if (target !== 'nodes' && target !== 'edges') throw new InputError('"target" must be "nodes" or "edges"');
    const k = int(input, 'k', 5, 1, 100);
    const types = Array.isArray(input.types) ? input.types.map(String) : undefined;
    const mode = input.mode === 'pooled' ? 'pooled' : 'best';
    const v = this.index();
    const st = v.status();
    const results: { id: string }[] = await this.embedding<{ id: string }[]>(() => (target === 'nodes' ? v.searchNodes(query, k, { types, mode }) : v.searchEdges(query, k)));
    const notices: string[] = [];
    if (st.state === 'mismatch') notices.push(`Results come from a stale index: ${st.message}`);
    if (st.pending > 0) notices.push(`${st.pending} note(s) are waiting to be embedded; results may be incomplete.`);
    const then = typeof input.then === 'string' && input.then.trim() ? await this.run(input.then, { hits: results.map((r) => r.id) }, input.backend) : undefined;
    return { target, stale: st.state === 'mismatch', results, ...(then ? { then } : {}), ...(notices.length ? { notices } : {}) };
  }

  /** Hybrid GraphRAG retrieve with bounded expansion and citations. */
  async retrieve(input: Obj): Promise<RetrieveResult> {
    const question = str(input, 'question')!;
    const opts = {
      k: int(input, 'k', 5, 1, 50),
      depth: int(input, 'depth', 1, 0, 3),
      neighborCap: int(input, 'neighbor_cap', 8, 1, 50),
      chunkCap: int(input, 'chunk_cap', 20, 1, 100),
    };
    return this.embedding(() => retrieve(this.index(), this.d.graph, question, opts));
  }
}
