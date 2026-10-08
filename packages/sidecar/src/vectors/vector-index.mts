import { createHash } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import {
  chunkNote,
  cosine,
  nodeScore,
  normalize,
  verbalizeEdge,
  type Graph,
  type NoteInput,
  type ScoreMode,
} from '@obsigraph/core';
import type { DataDir } from '../data-dir.mjs';
import { EmbeddingError, identityMismatch, type EmbeddingIdentity, type EmbeddingProvider } from './provider.mjs';
import type { Processor } from '../sync.mjs';

interface Vec {
  /** Hash of the embedded text; identical text reuses the vector. */
  textHash: string;
  vec: number[];
}

interface ChunkVec extends Vec {
  id: string;
  heading: string | null;
  body: string;
}

interface EdgeVec extends Vec {
  edgeId: string;
  heading: string | null;
  text: string;
}

interface NoteVectors {
  path: string;
  /** Hash of everything the vectors were computed from; a change means re-index. */
  sourceHash: string;
  chunks: ChunkVec[];
  edges: EdgeVec[];
}

interface Meta {
  format: 1;
  identity: EmbeddingIdentity | null;
  pending: string[];
}

export type VectorState = 'building' | 'ready' | 'degraded' | 'mismatch';

export interface VectorStatus {
  state: VectorState;
  message: string | null;
  chunks: number;
  edges: number;
  pending: number;
  identity: EmbeddingIdentity | null;
}

export interface NodeHit {
  id: string;
  score: number;
  labels: string[];
  title: string;
  citation: { path: string; heading: string | null; text: string };
}

export interface EdgeHit {
  id: string;
  score: number;
  sentence: string;
  source: string;
  target: string;
  citation: { path: string; heading: string | null };
}

const META = 'vectors/meta.json';
const hash = (s: string) => createHash('sha1').update(s).digest('hex');
const fileFor = (path: string) => `vectors/notes/${hash(path)}.json`;

/**
 * Chunk and edge-sentence vectors per note, stored in the sidecar data
 * directory. Updates are per note; vectors are reused for identical embedded
 * text; a model change blocks writes until an explicit rebuild; an unreachable
 * provider leaves old vectors searchable and queues the note.
 */
// @lat: [[vector-search#Vector index]]
export class VectorIndex implements Processor {
  readonly name = 'vector-index';
  private notes = new Map<string, NoteVectors>();
  private cache = new Map<string, number[]>();
  private meta: Meta = { format: 1, identity: null, pending: [] };
  private graph: Graph | null = null;
  private queue = new Set<string>();
  private running: Promise<void> | null = null;
  private retry: NodeJS.Timeout | null = null;
  private st: { state: VectorState; message: string | null } = { state: 'building', message: null };

  constructor(
    private readonly provider: EmbeddingProvider,
    private readonly data: DataDir,
    /** Note contents: a hash for change detection and the text for chunking. */
    private readonly source: { hashOf(path: string): string | undefined; read(path: string): Promise<string> },
    private readonly opts: { retryMs?: number } = {},
  ) {}

  status(): VectorStatus {
    let chunks = 0;
    let edges = 0;
    for (const n of this.notes.values()) {
      chunks += n.chunks.length;
      edges += n.edges.length;
    }
    return { ...this.st, chunks, edges, pending: this.queue.size, identity: this.meta.identity };
  }

  async open(): Promise<void> {
    this.meta = (await this.data.readJson<Meta>(META)) ?? this.meta;
    for (const p of this.meta.pending) this.queue.add(p);
    const dir = this.data.path('vectors/notes');
    const files = await readdir(dir).catch(() => [] as string[]);
    for (const f of files) {
      const n = await this.data.readJson<NoteVectors>(`vectors/notes/${f}`);
      if (n) this.remember(n);
    }
  }

  /** Start indexing a graph: anything new, changed or pending is queued. */
  // @tg: implements:: [[openspec:vector-index#Index is derived and rebuildable]]
  attach(graph: Graph): void {
    this.graph = graph;
    for (const n of graph.nodes()) {
      if (n.stub) continue;
      if (this.notes.get(n.id)?.sourceHash !== this.sourceHash(n.id)) this.queue.add(n.id);
    }
    for (const path of this.notes.keys()) if (!graph.node(path) || graph.node(path)!.stub) this.queue.add(path);
    this.kick();
  }

  upsert(note: NoteInput, graph: Graph): void {
    this.graph ??= graph;
    this.queue.add(note.path);
    // Edges into this note mention its title and type, so their sentences change too.
    for (const e of graph.inEdges(note.path)) this.queue.add(e.source);
    this.kick();
  }

  remove(path: string, graph: Graph): void {
    this.graph ??= graph;
    this.queue.add(path);
    this.kick();
  }

  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  stop(): void {
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
  }

  /** Discard every vector and re-embed the vault with the active model. */
  // @tg: implements:: [[openspec:vector-index#Index is derived and rebuildable]]
  // @tg: implements:: [[openspec:vector-index#Mismatch blocks writes and offers rebuild]]
  async rebuild(): Promise<void> {
    await this.idle();
    this.notes.clear();
    this.cache.clear();
    await rm(this.data.path('vectors/notes'), { recursive: true, force: true });
    this.meta = { format: 1, identity: null, pending: [] };
    this.st = { state: 'building', message: null };
    await this.data.writeJson(META, this.meta);
    if (this.graph) this.attach(this.graph);
    await this.idle();
  }

  // ---- search ---------------------------------------------------------------

  /** Top-k nodes by best chunk (or pooled) similarity, optionally filtered by type. */
  // @lat: [[vector-search#Node chunks]]
  // @tg: implements:: [[openspec:vector-index#Vector search over nodes]]
  async searchNodes(query: string, k: number, opts: { types?: string[]; mode?: ScoreMode } = {}): Promise<NodeHit[]> {
    return this.searchNodesBy(await this.embedQuery(query), k, opts);
  }

  /** Embed a question once; reuse the vector for several searches. */
  async embedQuery(query: string): Promise<number[]> {
    return normalize((await this.provider.embed([query]))[0]!);
  }

  /** Similarity of each chunk of a note to a query vector, best first. */
  // @tg: implements:: [[openspec:sidecar-mcp-graphrag#Citations on every chunk]]
  chunksOf(path: string, q: number[]): { heading: string | null; text: string; score: number }[] {
    const n = this.notes.get(path);
    if (!n) return [];
    return n.chunks.map((c) => ({ heading: c.heading, text: c.body, score: cosine(q, c.vec) })).sort((a, b) => b.score - a.score);
  }

  /** Sentence of an indexed edge, if any. */
  sentenceOf(edgeId: string): string | null {
    for (const n of this.notes.values()) for (const e of n.edges) if (e.edgeId === edgeId) return e.text;
    return null;
  }

  // @tg: implements:: [[openspec:vector-index#Vector search over nodes]]
  searchNodesBy(q: number[], k: number, opts: { types?: string[]; mode?: ScoreMode } = {}): NodeHit[] {
    const hits: NodeHit[] = [];
    for (const n of this.notes.values()) {
      const node = this.graph?.node(n.path);
      if (!node || n.chunks.length === 0) continue;
      if (opts.types?.length && !opts.types.some((t) => node.labels.includes(t))) continue;
      const sims = n.chunks.map((c) => cosine(q, c.vec));
      const best = n.chunks[sims.indexOf(Math.max(...sims))]!;
      hits.push({
        id: n.path,
        score: nodeScore(q, n.chunks.map((c) => c.vec), opts.mode ?? 'best'),
        labels: [...node.labels],
        title: String(node.props.title ?? n.path),
        citation: { path: n.path, heading: best.heading, text: best.body },
      });
    }
    return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, k);
  }

  /** Top-k edges by similarity of their verbalized sentence. */
  // @lat: [[vector-search#Edge verbalization]]
  // @tg: implements:: [[openspec:vector-index#Vector search over edges]]
  async searchEdges(query: string, k: number): Promise<EdgeHit[]> {
    return this.searchEdgesBy(await this.embedQuery(query), k);
  }

  // @tg: implements:: [[openspec:vector-index#Vector search over edges]]
  searchEdgesBy(q: number[], k: number): EdgeHit[] {
    const hits: EdgeHit[] = [];
    for (const n of this.notes.values()) {
      for (const e of n.edges) {
        const edge = this.graph?.edge(e.edgeId);
        if (!edge) continue;
        hits.push({ id: e.edgeId, score: cosine(q, e.vec), sentence: e.text, source: edge.source, target: edge.target, citation: { path: n.path, heading: e.heading } });
      }
    }
    return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, k);
  }

  // ---- indexing -------------------------------------------------------------

  private kick(): void {
    if (this.running || !this.graph) return;
    this.running = this.drain().finally(() => {
      this.running = null;
      // Work queued after the loop's last check must not be stranded.
      if (this.queue.size > 0 && this.st.state === 'ready') this.kick();
    });
  }

  // @tg: implements:: [[openspec:vector-index#Unavailable provider degrades gracefully]]
  private async drain(): Promise<void> {
    if (!(await this.checkIdentity())) return;
    this.st = { state: 'building', message: null };
    while (this.queue.size > 0) {
      const path = this.queue.values().next().value as string;
      try {
        await this.indexNote(path);
        this.queue.delete(path);
      } catch (e) {
        if (!(e instanceof EmbeddingError)) throw e;
        this.st = { state: 'degraded', message: e.message };
        await this.persistMeta();
        this.scheduleRetry();
        return;
      }
    }
    this.st = { state: 'ready', message: null };
    await this.persistMeta();
  }

  /** Probe the active model; refuse to write when it differs from the stored identity. */
  // @tg: implements:: [[openspec:embedding-provider#Mismatch never mixes vectors]]
  // @tg: implements:: [[openspec:sidecar-service#Embedding provider configuration]]
  // @tg: implements:: [[openspec:vector-index#Index records model identity]]
  // @tg: implements:: [[openspec:vector-index#Mismatch blocks writes and offers rebuild]]
  private async checkIdentity(): Promise<boolean> {
    let active: EmbeddingIdentity;
    try {
      active = await this.provider.identity();
    } catch (e) {
      if (!(e instanceof EmbeddingError)) throw e;
      this.st = { state: 'degraded', message: e.message };
      await this.persistMeta();
      this.scheduleRetry();
      return false;
    }
    const mismatch = identityMismatch(this.meta.identity, active);
    if (mismatch) {
      this.st = { state: 'mismatch', message: mismatch };
      await this.persistMeta();
      return false;
    }
    if (!this.meta.identity) {
      this.meta.identity = active;
      await this.persistMeta();
    }
    return true;
  }

  // @tg: implements:: [[openspec:vector-index#Unavailable provider degrades gracefully]]
  private scheduleRetry(): void {
    if (this.retry) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      this.kick();
    }, this.opts.retryMs ?? 30_000);
    this.retry.unref?.();
  }

  // @tg: implements:: [[openspec:vector-index#Incremental update per file]]
  // @tg: implements:: [[openspec:vector-index#Index covers nodes and edges]]
  private async indexNote(path: string): Promise<void> {
    const graph = this.graph!;
    const node = graph.node(path);
    if (!node || node.stub) {
      this.forget(path);
      await rm(this.data.path(fileFor(path)), { force: true });
      return;
    }
    const sourceHash = this.sourceHash(path);
    if (this.notes.get(path)?.sourceHash === sourceHash) return;

    const frontmatter = Object.fromEntries(Object.entries(node.props).filter(([k]) => k !== 'path' && k !== 'title'));
    const chunks = chunkNote({ path, text: await this.source.read(path), frontmatter, labels: node.labels });
    const sentences = graph.outEdges(path).map((e) => verbalizeEdge(e, graph));
    const texts = [...chunks.map((c) => c.text), ...sentences.map((s) => s.text)];
    const vectors = await this.vectorsFor(texts);
    const entry: NoteVectors = {
      path,
      sourceHash,
      chunks: chunks.map((c, i) => ({ id: c.id, heading: c.heading, body: c.body, textHash: hash(c.text), vec: vectors[i]! })),
      edges: sentences.map((s, i) => ({ edgeId: s.edgeId, heading: s.heading, text: s.text, textHash: hash(s.text), vec: vectors[chunks.length + i]! })),
    };
    this.forget(path);
    this.remember(entry);
    await this.data.writeJson(fileFor(path), entry);
  }

  /** Embed only texts not already in the cache. */
  // @tg: implements:: [[openspec:vector-index#Incremental update per file]]
  private async vectorsFor(texts: string[]): Promise<number[][]> {
    const missing = [...new Set(texts.filter((t) => !this.cache.has(hash(t))))];
    if (missing.length) {
      const fresh = await this.provider.embed(missing);
      missing.forEach((t, i) => this.cache.set(hash(t), normalize(fresh[i]!)));
    }
    return texts.map((t) => this.cache.get(hash(t))!);
  }

  private remember(n: NoteVectors): void {
    this.notes.set(n.path, n);
    for (const v of [...n.chunks, ...n.edges]) this.cache.set(v.textHash, v.vec);
  }

  private forget(path: string): void {
    this.notes.delete(path);
  }

  /** Everything a note's vectors depend on: its text, labels, and the endpoints of its edges. */
  private sourceHash(path: string): string {
    const g = this.graph!;
    const n = g.node(path)!;
    const ends = g.outEdges(path).map((e) => {
      const t = g.node(e.target);
      return [e.id, e.type, e.sign, JSON.stringify(e.props), t?.props.title, t?.labels];
    });
    return hash(JSON.stringify([this.source.hashOf(path) ?? '', n.labels, n.props, ends]));
  }

  private async persistMeta(): Promise<void> {
    this.meta.pending = [...this.queue];
    await this.data.writeJson(META, this.meta);
  }
}
