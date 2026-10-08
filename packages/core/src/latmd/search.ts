import { cosine } from '../embed/chunk.js';
import type { LatIndex } from './index.js';

export interface SearchDoc {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  /** Heading and the trailing id segments. */
  title: string;
  summary: string;
  /** The section's own text, up to the next heading. */
  body: string;
}

export interface SearchHit {
  id: string;
  score: number;
  doc: SearchDoc;
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'it', 'as', 'by', 'with', 'be', 'at', 'this', 'that']);

function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Lowercased word tokens with light stemming and stop words removed. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
}

/** One search document per section, with its own body text (not its children's). */
// @tg: implements:: [[openspec:tg-search#Lexical default]]
export function buildSearchDocs(index: LatIndex, readText: (filePath: string) => string | null): SearchDoc[] {
  const cache = new Map<string, string[]>();
  const linesOf = (p: string): string[] => {
    if (!cache.has(p)) cache.set(p, (readText(p) ?? '').split('\n'));
    return cache.get(p)!;
  };
  return index.sections().map((s) => {
    const body = linesOf(s.filePath).slice(s.startLine, s.endLine).join('\n');
    const tail = s.id.split('#').slice(1).join(' ');
    return { id: s.id, file: s.filePath, startLine: s.startLine, endLine: s.endLine, title: `${s.heading} ${tail}`, summary: s.firstParagraph, body };
  });
}

const FIELD_WEIGHT = { title: 3, summary: 2, body: 1 } as const;
const K1 = 1.2;
const B = 0.75;

interface FieldIndex {
  tf: Map<string, number>[];
  len: number[];
  avg: number;
  df: Map<string, number>;
}

function indexField(texts: string[]): FieldIndex {
  const tf: Map<string, number>[] = [];
  const df = new Map<string, number>();
  const len: number[] = [];
  for (const t of texts) {
    const tokens = tokenize(t);
    const m = new Map<string, number>();
    for (const w of tokens) m.set(w, (m.get(w) ?? 0) + 1);
    for (const w of m.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    tf.push(m);
    len.push(tokens.length);
  }
  return { tf, len, avg: len.reduce((a, b) => a + b, 0) / Math.max(len.length, 1) || 1, df };
}

/** BM25 over title, summary and body with field weights; rebuilt per query batch since docs corpora are small. */
// @lat: [[cli#Search]]
// @tg: implements:: [[openspec:tg-search#Lexical default]]
export class LexicalIndex {
  private readonly fields: Record<keyof typeof FIELD_WEIGHT, FieldIndex>;

  constructor(readonly docs: SearchDoc[]) {
    this.fields = { title: indexField(docs.map((d) => d.title)), summary: indexField(docs.map((d) => d.summary)), body: indexField(docs.map((d) => d.body)) };
  }

  search(query: string, limit = 10): SearchHit[] {
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) return [];
    const n = this.docs.length;
    const phrase = query.trim().toLowerCase();
    const hits: SearchHit[] = [];
    for (let i = 0; i < n; i++) {
      let score = 0;
      for (const [name, weight] of Object.entries(FIELD_WEIGHT) as [keyof typeof FIELD_WEIGHT, number][]) {
        const f = this.fields[name];
        for (const t of terms) {
          const tf = f.tf[i]!.get(t);
          if (!tf) continue;
          const df = f.df.get(t) ?? 0;
          const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
          score += weight * idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * f.len[i]!) / f.avg)));
        }
      }
      if (score > 0 && phrase.length > 2 && this.docs[i]!.title.toLowerCase().includes(phrase)) score *= 1.5;
      if (score > 0) hits.push({ id: this.docs[i]!.id, score, doc: this.docs[i]! });
    }
    return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
  }
}

/** Rank documents by cosine similarity to a query vector. */
export function vectorRank(docs: SearchDoc[], vectors: (number[] | undefined)[], query: number[], limit = 50): SearchHit[] {
  const hits: SearchHit[] = [];
  docs.forEach((doc, i) => {
    const v = vectors[i];
    if (v) hits.push({ id: doc.id, doc, score: cosine(v, query) });
  });
  return hits.filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Reciprocal rank fusion of rankings, so lexical and vector scores need no calibration. */
// @tg: implements:: [[openspec:tg-search#Hybrid ranking]]
export function fuseRanks(rankings: SearchHit[][], limit = 10, k = 60): (SearchHit & { sources: number })[] {
  const acc = new Map<string, SearchHit & { sources: number }>();
  for (const r of rankings) {
    r.forEach((h, rank) => {
      const cur = acc.get(h.id);
      const add = 1 / (k + rank + 1);
      if (cur) {
        cur.score += add;
        cur.sources++;
      } else acc.set(h.id, { ...h, score: add, sources: 1 });
    });
  }
  return [...acc.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}
