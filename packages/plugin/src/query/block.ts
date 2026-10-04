import type { QueryResult } from '@obsigraph/core';

export type ViewMode = 'auto' | 'table' | 'graph';

export interface BlockOptions {
  view: ViewMode;
  /** Table columns to show, in order; null shows all. */
  columns: string[] | null;
  /** Graph height in pixels. */
  height: number;
  /** Query engine; null uses the plugin default. */
  backend: 'builtin' | 'ladybug' | null;
  /** `hide` removes code nodes from the graph; the code layer itself is a plugin setting. */
  code: 'show' | 'hide';
}

export interface HeaderError {
  line: number;
  message: string;
}

/** Raw `node.<Type>` and `edge.<type>` header entries, validated later. */
export interface HeaderStyles {
  nodes: Record<string, Record<string, string>>;
  edges: Record<string, Record<string, string>>;
}

export interface ParsedBlock {
  options: BlockOptions;
  styles: HeaderStyles;
  query: string;
  /** Zero-based line in the block where the query starts. */
  queryLine: number;
  errors: HeaderError[];
}

const HEADER_LINE = /^\s*([A-Za-z][\w-]*(?:\.[\p{L}\p{N}_-]+)?)\s*:\s*(.*?)\s*$/u;
const KNOWN = new Set(['view', 'columns', 'height', 'backend', 'code']);

export const DEFAULT_OPTIONS: BlockOptions = { view: 'auto', columns: null, height: 360, backend: null, code: 'show' };

/**
 * Split a `graph-query` block into its `key: value` header and Cypher body.
 * The header is every leading line of that form; a blank line may separate it.
 */
// @lat: [[query-engine#Query block]]
export function parseBlock(source: string): ParsedBlock {
  const lines = source.split(/\r?\n/);
  const options: BlockOptions = { ...DEFAULT_OPTIONS };
  const errors: HeaderError[] = [];
  const styles: HeaderStyles = { nodes: {}, edges: {} };
  let i = 0;

  for (; i < lines.length; i++) {
    const m = HEADER_LINE.exec(lines[i]!);
    if (!m) break;
    const key = m[1]!.toLowerCase();
    const value = m[2]!;
    const scoped = /^(node|edge)\.(.+)$/i.exec(m[1]!);
    if (scoped) {
      // @lat: [[visualization#Styling]]
      const pairs = parseStylePairs(value);
      if (typeof pairs === 'string') errors.push({ line: i, message: pairs });
      else (scoped[1]!.toLowerCase() === 'node' ? styles.nodes : styles.edges)[scoped[2]!] = pairs;
      continue;
    }
    if (!KNOWN.has(key)) {
      errors.push({ line: i, message: `Unknown option '${m[1]}' (expected view, columns, height, backend, code, node.<Type> or edge.<type>)` });
      continue;
    }
    if (key === 'view') {
      const v = value.toLowerCase();
      if (v === 'auto' || v === 'table' || v === 'graph') options.view = v;
      else errors.push({ line: i, message: `Invalid view '${value}' (expected auto, table or graph)` });
    } else if (key === 'columns') {
      const cols = value.split(',').map((c) => c.trim()).filter(Boolean);
      if (cols.length === 0) errors.push({ line: i, message: 'columns needs at least one column name' });
      else options.columns = cols;
    } else if (key === 'backend') {
      // @lat: [[ladybug-mirror#Hosted by the sidecar]]
      const b = value.toLowerCase();
      if (b === 'builtin' || b === 'ladybug') options.backend = b;
      else errors.push({ line: i, message: `Invalid backend '${value}' (expected builtin or ladybug)` });
    } else if (key === 'code') {
      const c = value.toLowerCase();
      if (c === 'show' || c === 'hide') options.code = c;
      else errors.push({ line: i, message: `Invalid code '${value}' (expected show or hide)` });
    } else if (key === 'height') {
      const h = Number(value.replace(/px$/, ''));
      if (!Number.isFinite(h) || h < 100 || h > 4000) errors.push({ line: i, message: `Invalid height '${value}' (100-4000)` });
      else options.height = h;
    }
  }
  while (i < lines.length && lines[i]!.trim() === '') i++;
  return { options, styles, query: lines.slice(i).join('\n'), queryLine: i, errors };
}

/** Parse `color=red, shape=diamond` (also `;`-separated); commas inside parentheses are kept. */
export function parseStylePairs(value: string): Record<string, string> | string {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  const out: Record<string, string> = {};
  for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
    const eq = part.indexOf('=');
    if (eq <= 0) return `Expected attribute=value but found '${part}'`;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  if (Object.keys(out).length === 0) return 'Style entry needs at least one attribute=value';
  return out;
}

/** Pick the renderer: graph when any column holds nodes or relationships. */
export function chooseView(result: QueryResult, view: ViewMode): 'table' | 'graph' {
  if (view !== 'auto') return view;
  return result.columns.some((c) => c.kind !== 'scalar') ? 'graph' : 'table';
}

/** Resolve the `columns` option to column indexes; unknown names are errors. */
export function selectColumns(result: QueryResult, columns: string[] | null): { indexes: number[]; errors: string[] } {
  if (!columns) return { indexes: result.columns.map((_, i) => i), errors: [] };
  const indexes: number[] = [];
  const errors: string[] = [];
  for (const name of columns) {
    const idx = result.columns.findIndex((c) => c.name === name);
    if (idx < 0) errors.push(`Unknown column '${name}' (available: ${result.columns.map((c) => c.name).join(', ')})`);
    else indexes.push(idx);
  }
  return { indexes, errors };
}
