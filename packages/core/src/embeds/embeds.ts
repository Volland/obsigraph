import type { Diagnostic, Sign } from '../edges/parse.js';
import type { PropValue } from '../edges/props.js';
import { titleOf, type Graph, type GraphEdge } from '../graph/graph.js';

export type EdgeEmbed =
  | { kind: 'id'; id: string; prop: string | null }
  | { kind: 'endpoints'; source: string; type: string; sign: Sign | null; target: string; prop: string | null };

export interface EmbedOccurrence {
  raw: string;
  line: number;
  /** Offset of the embed within its line. */
  column: number;
  embed: EdgeEmbed | null;
  error: string | null;
}

/** Matches `{{edge: ...}}`; only the `edge:` prefix is claimed. */
export const EMBED_PATTERN = /\{\{\s*edge:\s*([^{}]*?)\s*\}\}/g;

const PROP_SUFFIX = /^(.*?)\s+\.\s*([\p{L}_][\p{L}\p{N}_-]*)$/u;
const ENDPOINTS = /^(.+?)\s+-([+-]?)([\p{L}_][\p{L}\p{N}_-]*)->\s+(.+)$/u;

/**
 * Parse the inside of an embed. `Source -type-> Target` (optionally with
 * `[[ ]]` around endpoints and a `+`/`-` sign before the type) or a pinned id,
 * each with an optional ` . property` suffix.
 */
// @lat: [[edge-syntax#Property embeds]]
export function parseEmbed(inner: string): EdgeEmbed | string {
  let body = inner.trim();
  let prop: string | null = null;
  const p = PROP_SUFFIX.exec(body);
  if (p) {
    body = p[1]!.trim();
    prop = p[2]!;
  }
  if (!body) return 'Empty edge embed';
  if (body.includes('->')) {
    const m = ENDPOINTS.exec(body);
    if (!m) return `Expected 'Source -type-> Target' but found '${body}'`;
    const source = unwrap(m[1]!);
    const target = unwrap(m[4]!);
    if (!source || !target) return 'Edge embed needs both a source and a target';
    const sign: Sign | null = m[2] === '-' ? -1 : m[2] === '+' ? 1 : null;
    return { kind: 'endpoints', source, type: m[3]!, sign, target, prop };
  }
  if (/\s/.test(body)) return `Edge id '${body}' cannot contain spaces`;
  return { kind: 'id', id: body, prop };
}

/** Find embeds in a note, skipping fenced code and inline code. */
export function findEmbeds(text: string): EmbedOccurrence[] {
  const out: EmbedOccurrence[] = [];
  let fence: string | null = null;
  text.split(/\r?\n/).forEach((line, n) => {
    const f = /^\s*(```|~~~)/.exec(line);
    if (f) {
      if (fence === null) fence = f[1]!;
      else if (f[1] === fence) fence = null;
      return;
    }
    if (fence !== null) return;
    const masked = line.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));
    for (const m of masked.matchAll(EMBED_PATTERN)) {
      const at = m.index ?? 0;
      const raw = line.slice(at, at + m[0].length);
      const parsed = parseEmbed(m[1]!);
      out.push({ raw, line: n, column: at, embed: typeof parsed === 'string' ? null : parsed, error: typeof parsed === 'string' ? parsed : null });
    }
  });
  return out;
}

export type EmbedResolution =
  | { status: 'ok'; edge: GraphEdge; matches: number }
  | { status: 'unresolved'; reason: string };

/** One lookup for both forms: pinned id, or endpoints + type + optional sign. */
// @lat: [[edge-syntax#Property embeds]]
export function resolveEmbed(graph: Graph, embed: EdgeEmbed, fromPath: string): EmbedResolution {
  if (embed.kind === 'id') {
    const edge = graph.edge(embed.id);
    return edge ? { status: 'ok', edge, matches: 1 } : { status: 'unresolved', reason: `no edge with id '${embed.id}'` };
  }
  const describe = `${embed.source} -${embed.sign === -1 ? '-' : embed.sign === 1 ? '+' : ''}${embed.type}-> ${embed.target}`;
  const source = graph.resolveLink(embed.source, fromPath);
  const target = graph.resolveLink(embed.target, fromPath);
  if (!source || !target) return { status: 'unresolved', reason: `edge not found: ${describe}` };
  const matches = graph
    .outEdges(source)
    .filter((e) => e.type === embed.type && e.target === target && (embed.sign === null || e.sign === embed.sign))
    .sort((a, b) => a.line - b.line);
  if (matches.length === 0) return { status: 'unresolved', reason: `edge not found: ${describe}` };
  return { status: 'ok', edge: matches[0]!, matches: matches.length };
}

export type EmbedView =
  | { kind: 'value'; text: string }
  | { kind: 'table'; rows: [string, string][] }
  | { kind: 'empty'; text: string }
  | { kind: 'unresolved'; text: string };

/** What an embed shows: one value, the property table, an empty state or an unresolved marker. */
export function viewEmbed(embed: EdgeEmbed, res: EmbedResolution): EmbedView {
  if (res.status === 'unresolved') return { kind: 'unresolved', text: res.reason };
  const props = Object.entries(res.edge.props);
  if (embed.prop) {
    if (!(embed.prop in res.edge.props)) return { kind: 'unresolved', text: `edge has no property '${embed.prop}'` };
    return { kind: 'value', text: show(res.edge.props[embed.prop]!) };
  }
  if (props.length === 0) return { kind: 'empty', text: 'no properties' };
  return { kind: 'table', rows: props.map(([k, v]) => [k, show(v)]) };
}

/** Embeds per note, for pinned-ID and ambiguity warnings across the vault. */
// @lat: [[edge-syntax#Edge identity]]
export class EmbedIndex {
  private readonly byPath = new Map<string, EmbedOccurrence[]>();

  upsert(path: string, text: string): void {
    const found = findEmbeds(text);
    if (found.length > 0) this.byPath.set(path, found);
    else this.byPath.delete(path);
  }
  remove(path: string): void {
    this.byPath.delete(path);
  }
  rename(oldPath: string, newPath: string): void {
    const v = this.byPath.get(oldPath);
    this.byPath.delete(oldPath);
    if (v) this.byPath.set(newPath, v);
  }

  /**
   * Warnings: endpoint embeds that resolve to an unpinned edge (with a
   * suggested id), ambiguous endpoint embeds, and malformed embeds. Pinned-id
   * references and unreferenced edges never warn.
   */
  warnings(graph: Graph): Diagnostic[] {
    const out: Diagnostic[] = [];
    for (const [path, list] of this.byPath) {
      for (const occ of list) {
        const at = { path, line: occ.line, column: occ.column };
        if (!occ.embed) {
          out.push({ ...at, message: `Malformed edge embed ${occ.raw}: ${occ.error}` });
          continue;
        }
        if (occ.embed.kind !== 'endpoints') continue;
        const res = resolveEmbed(graph, occ.embed, path);
        if (res.status !== 'ok') continue;
        if (res.matches > 1) {
          out.push({ ...at, message: `${res.matches} edges match ${occ.raw}; showing the first. Pin the one you mean with an id.` });
        }
        if (res.edge.props.id === undefined) {
          out.push({
            ...at,
            message: `${occ.raw} refers to an unpinned edge in ${res.edge.source} line ${res.edge.line + 1}; add {id: "${suggestId(res.edge)}"} to keep the reference stable`,
          });
        }
      }
    }
    return out;
  }
}

/** Copy-ready id suggestion such as `alice-knows-bob`. */
export function suggestId(e: GraphEdge): string {
  return [titleOf(e.source), e.type, titleOf(e.target)]
    .join('-')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function unwrap(s: string): string {
  const t = s.trim();
  const m = /^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/.exec(t);
  return (m ? m[1]! : t).trim();
}

function show(v: PropValue): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.map(show).join(', ');
  return String(v);
}
