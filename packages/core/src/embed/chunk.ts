import { splitFrontmatter } from '../schema/frontmatter.js';
import type { Graph, GraphEdge } from '../graph/graph.js';
import { titleOf } from '../graph/graph.js';

export interface Chunk {
  /** Stable id: hash of path, heading path, ordinal and body. */
  id: string;
  path: string;
  /** Nearest heading, or null for text before the first heading. */
  heading: string | null;
  headingPath: string[];
  /** Position within its section. */
  ordinal: number;
  /** Original text, returned in citations. */
  body: string;
  /** Text that is embedded: context prefix plus body. */
  text: string;
}

export interface ChunkInput {
  path: string;
  text: string;
  frontmatter?: Record<string, unknown> | null;
  labels?: string[];
}

export const DEFAULT_CHUNK_CHARS = 1500;

/** Pure-JS 53-bit string hash (cyrb53); two seeds give a 104-bit id without node:crypto. */
function cyrb53(s: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

// @tg: implements:: [[openspec:chunking-verbalization#Deterministic chunk identity]]
export function stableId(s: string): string {
  return cyrb53(s, 1) + cyrb53(s, 2);
}

function show(v: unknown, max = 80): string {
  const s = Array.isArray(v) ? v.map((x) => show(x, max)).join(', ') : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Context prepended to every chunk: title, type labels, then frontmatter. */
// @tg: implements:: [[openspec:chunking-verbalization#Context prepended to every chunk]]
export function chunkContext(title: string, labels: string[], frontmatter: Record<string, unknown> | null | undefined): string {
  const lines = [labels.length ? `${title} (${labels.join(', ')})` : title];
  for (const [k, v] of Object.entries(frontmatter ?? {})) {
    if (k === 'type' || k === 'schema' || v === null || v === undefined || v === '') continue;
    lines.push(`${k}: ${show(v)}`);
  }
  return lines.join('\n');
}

/** Split text into pieces of at most `max` chars on paragraph, then sentence, then word boundaries. */
// @tg: implements:: [[openspec:chunking-verbalization#Heading-aware chunking]]
function pack(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  const push = (piece: string, sep: string) => {
    if (!cur) cur = piece;
    else if (cur.length + sep.length + piece.length <= max) cur += sep + piece;
    else {
      out.push(cur);
      cur = piece;
    }
  };
  const split = (piece: string, level: number) => {
    if (piece.length <= max) return push(piece, level === 0 ? '\n\n' : ' ');
    // Sentence split without lookbehind, which iOS before 16.4 does not support.
    if (level === 0) return piece.replace(/([.!?])\s+/g, '$1\u0000').split('\u0000').forEach((s) => split(s, 1));
    if (level === 1) return piece.split(/\s+/).forEach((w) => split(w, 2));
    for (let i = 0; i < piece.length; i += max) push(piece.slice(i, i + max), ' ');
  };
  for (const para of text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) split(para, 0);
  if (cur) out.push(cur);
  return out;
}

/**
 * Chunk a note by heading, then by size, prefixing title, type labels and
 * frontmatter to the embedded text and recording path and heading for citations.
 */
// @lat: [[vector-search#Node chunks]]
// @tg: implements:: [[openspec:chunking-verbalization#Chunk provenance]]
// @tg: implements:: [[openspec:chunking-verbalization#Context prepended to every chunk]]
// @tg: implements:: [[openspec:chunking-verbalization#Deterministic chunk identity]]
// @tg: implements:: [[openspec:chunking-verbalization#Heading-aware chunking]]
// @tg: implements:: [[openspec:vector-index#Index covers nodes and edges]]
export function chunkNote(note: ChunkInput, maxChars = DEFAULT_CHUNK_CHARS): Chunk[] {
  const { body } = splitFrontmatter(note.text);
  const context = chunkContext(titleOf(note.path), note.labels ?? [], note.frontmatter);
  const sections: { headingPath: string[]; lines: string[] }[] = [{ headingPath: [], lines: [] }];
  const stack: { level: number; text: string }[] = [];
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const f = /^\s*(```|~~~)/.exec(line);
    if (f) fence = fence === null ? f[1]! : f[1] === fence ? null : fence;
    const h = fence === null && !f ? /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line) : null;
    if (h) {
      const level = h[1]!.length;
      while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
      stack.push({ level, text: h[2]! });
      sections.push({ headingPath: stack.map((s) => s.text), lines: [] });
    } else {
      sections[sections.length - 1]!.lines.push(line);
    }
  }
  const chunks: Chunk[] = [];
  for (const sec of sections) {
    const pieces = pack(sec.lines.join('\n'), Math.max(50, maxChars - context.length - 2));
    pieces.forEach((piece, ordinal) => {
      const heading = sec.headingPath[sec.headingPath.length - 1] ?? null;
      chunks.push({
        id: stableId(`${note.path}\u0000${sec.headingPath.join('\u0001')}\u0000${ordinal}\u0000${piece}`),
        path: note.path,
        heading,
        headingPath: sec.headingPath,
        ordinal,
        body: piece,
        text: `${context}\n\n${piece}`,
      });
    });
  }
  return chunks;
}

/** `worksAt`, `works_at`, `works-at` -> `works at`. */
// @tg: implements:: [[openspec:chunking-verbalization#Edge verbalization]]
export function verbOf(type: string): string {
  return type
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
}

export interface EdgeSentence {
  edgeId: string;
  path: string;
  heading: string | null;
  text: string;
}

/**
 * Render an edge as a sentence for embedding:
 * `Alice (Person) knows Bob (Person) - since 2020, met at conf`.
 */
// @lat: [[vector-search#Edge verbalization]]
// @tg: implements:: [[openspec:chunking-verbalization#Edge sentence provenance]]
// @tg: implements:: [[openspec:chunking-verbalization#Edge verbalization]]
// @tg: implements:: [[openspec:chunking-verbalization#Negative edges are verbalized as negative]]
export function verbalizeEdge(e: GraphEdge, graph: Graph): EdgeSentence {
  const name = (id: string) => {
    const n = graph.node(id);
    const title = String(n?.props.title ?? titleOf(id));
    return n && n.labels.length ? `${title} (${n.labels.join(', ')})` : title;
  };
  const props = Object.entries(e.props)
    .filter(([k, v]) => k !== 'id' && v !== null && v !== undefined && v !== '')
    .map(([k, v]) => (k === 'label' ? show(v) : `${k} ${show(v)}`));
  const verb = `${verbOf(e.type)}${e.sign < 0 ? ' (negative)' : ''}`;
  const text = `${name(e.source)} ${verb} ${name(e.target)}${props.length ? ` - ${props.join(', ')}` : ''}`;
  return { edgeId: e.id, path: e.source, heading: e.heading, text };
}

/** Cosine similarity; vectors of different length come from different models and are an error, never NaN. */
// @tg: implements:: [[openspec:vector-index#Mismatch blocks writes and offers rebuild]]
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new RangeError(`Cannot compare vectors of different dimensions (${a.length} and ${b.length})`);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n ? v.map((x) => x / n) : v;
}

/** Mean of normalized chunk vectors, normalized again. */
// @tg: implements:: [[openspec:chunking-verbalization#Node score aggregation]]
export function poolVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const sum = new Array<number>(vectors[0]!.length).fill(0);
  for (const v of vectors.map(normalize)) v.forEach((x, i) => (sum[i]! += x));
  return normalize(sum);
}

export type ScoreMode = 'best' | 'pooled';

/** Node score from its chunks: best chunk similarity, or similarity of the pooled vector. */
// @lat: [[vector-search#Node chunks]]
// @tg: implements:: [[openspec:chunking-verbalization#Node score aggregation]]
export function nodeScore(query: number[], chunkVectors: number[][], mode: ScoreMode = 'best'): number {
  if (chunkVectors.length === 0) return 0;
  if (mode === 'pooled') return cosine(query, poolVectors(chunkVectors));
  return Math.max(...chunkVectors.map((v) => cosine(query, v)));
}
