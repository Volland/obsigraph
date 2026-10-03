import type { QueryResult } from '@obsigraph/core';

export type ViewMode = 'auto' | 'table' | 'graph';

export interface BlockOptions {
  view: ViewMode;
  /** Table columns to show, in order; null shows all. */
  columns: string[] | null;
  /** Graph height in pixels. */
  height: number;
}

export interface HeaderError {
  line: number;
  message: string;
}

export interface ParsedBlock {
  options: BlockOptions;
  query: string;
  /** Zero-based line in the block where the query starts. */
  queryLine: number;
  errors: HeaderError[];
}

const HEADER_LINE = /^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/;
const KNOWN = new Set(['view', 'columns', 'height']);

export const DEFAULT_OPTIONS: BlockOptions = { view: 'auto', columns: null, height: 360 };

/**
 * Split a `graph-query` block into its `key: value` header and Cypher body.
 * The header is every leading line of that form; a blank line may separate it.
 */
// @lat: [[query-engine#Query block]]
export function parseBlock(source: string): ParsedBlock {
  const lines = source.split(/\r?\n/);
  const options: BlockOptions = { ...DEFAULT_OPTIONS };
  const errors: HeaderError[] = [];
  let i = 0;

  for (; i < lines.length; i++) {
    const m = HEADER_LINE.exec(lines[i]!);
    if (!m) break;
    const key = m[1]!.toLowerCase();
    const value = m[2]!;
    if (!KNOWN.has(key)) {
      errors.push({ line: i, message: `Unknown option '${m[1]}' (expected view, columns or height)` });
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
    } else if (key === 'height') {
      const h = Number(value.replace(/px$/, ''));
      if (!Number.isFinite(h) || h < 100 || h > 4000) errors.push({ line: i, message: `Invalid height '${value}' (100-4000)` });
      else options.height = h;
    }
  }
  while (i < lines.length && lines[i]!.trim() === '') i++;
  return { options, query: lines.slice(i).join('\n'), queryLine: i, errors };
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
