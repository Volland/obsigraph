import { createHash } from 'node:crypto';
import type { Graph } from '@obsigraph/core';

/** Typed property column kinds: number, string, boolean, string list, number list, JSON text. */
export type ColType = 'n' | 's' | 'b' | 'ls' | 'ln' | 'j';

export const COLUMN_SQL: Record<ColType, string> = { n: 'DOUBLE', s: 'STRING', b: 'BOOLEAN', ls: 'STRING[]', ln: 'DOUBLE[]', j: 'STRING' };

export interface TypedValue {
  t: ColType;
  v: unknown;
}

/** Column kind for a property value; null for null/undefined (no column). */
export function colType(v: unknown): ColType | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? 'n' : 's';
  if (typeof v === 'string' || v instanceof Date) return 's';
  if (typeof v === 'boolean') return 'b';
  if (Array.isArray(v)) {
    if (v.length > 0 && v.every((x) => typeof x === 'number' && Number.isFinite(x))) return 'ln';
    if (v.every((x) => typeof x === 'string')) return 'ls';
  }
  return 'j';
}

function columnValue(v: unknown, t: ColType): unknown {
  if (t === 's') return v instanceof Date ? v.toISOString() : String(v);
  if (t === 'j') return JSON.stringify(v, (_k, x) => (x instanceof Date ? x.toISOString() : x));
  return v;
}

/** Column for a property of a given kind, e.g. `age` as number -> `p_age_n`. */
export function propColumn(name: string, t: ColType): string {
  const safe = name.replace(/[^A-Za-z0-9_]/g, '_');
  const suffix = safe === name ? '' : `_${createHash('sha1').update(name).digest('hex').slice(0, 6)}`;
  return `p_${safe}${suffix}_${t}`;
}

/** Node properties that live in base columns rather than property columns. */
const NODE_BASE = new Set(['title', 'path']);

function typedColumns(props: Record<string, unknown>, skip: Set<string>): Record<string, TypedValue> {
  const out: Record<string, TypedValue> = {};
  for (const [k, v] of Object.entries(props)) {
    if (skip.has(k)) continue;
    const t = colType(v);
    if (t) out[propColumn(k, t)] = { t, v: columnValue(v, t) };
  }
  return out;
}

/** Property name -> kinds present, for translating `n.prop` to a column. */
export interface PropertyTypes {
  node: Map<string, Set<ColType>>;
  rel: Map<string, Set<ColType>>;
}

export function propertyTypes(graph: Graph): PropertyTypes {
  const node = new Map<string, Set<ColType>>();
  const rel = new Map<string, Set<ColType>>();
  const add = (m: Map<string, Set<ColType>>, k: string, v: unknown) => {
    const t = colType(v);
    if (!t) return;
    let s = m.get(k);
    if (!s) m.set(k, (s = new Set()));
    s.add(t);
  };
  for (const n of graph.nodes()) for (const [k, v] of Object.entries(n.props)) if (!NODE_BASE.has(k)) add(node, k, v);
  for (const e of graph.edges()) for (const [k, v] of Object.entries(e.props)) add(rel, k, v);
  return { node, rel };
}

/** Placeholder relationship table that is always empty, so impossible patterns stay valid Cypher. */
export const EMPTY_REL_TABLE = 'obsigraph_none';

export interface NodeRow {
  id: string;
  labels: string[];
  title: string;
  path: string | null;
  stub: boolean;
  /** Node properties as JSON (frontmatter, path, title). */
  props: string;
  /** Typed property columns. */
  cols: Record<string, TypedValue>;
  sig: string;
}

export interface EdgeRow {
  id: string;
  type: string;
  source: string;
  target: string;
  sign: 1 | -1;
  heading: string | null;
  props: string;
  cols: Record<string, TypedValue>;
  sig: string;
}

/** What the mirror currently holds: signatures keyed by id. */
export interface MirrorState {
  nodes: Map<string, string>;
  edges: Map<string, { sig: string; type: string }>;
}

export interface MirrorDiff {
  deleteEdges: { id: string; type: string }[];
  deleteNodes: string[];
  upsertNodes: NodeRow[];
  /** Nodes in `upsertNodes` that already exist (update instead of create). */
  existingNodes: Set<string>;
  insertEdges: EdgeRow[];
}

export const emptyState = (): MirrorState => ({ nodes: new Map(), edges: new Map() });

function sig(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex');
}

function json(x: unknown): string {
  return JSON.stringify(x, (_k, v) => (v instanceof Date ? v.toISOString() : v)) ?? 'null';
}

/** Rows for every node and edge in the graph, each with a content signature. */
// @lat: [[ladybug-mirror#Storage layout]]
export function graphRows(graph: Graph): { nodes: Map<string, NodeRow>; edges: Map<string, EdgeRow> } {
  const nodes = new Map<string, NodeRow>();
  for (const n of graph.nodes()) {
    const base = {
      id: n.id,
      labels: [...n.labels],
      title: String(n.props.title ?? n.id),
      path: n.stub ? null : n.id,
      stub: n.stub,
      props: json(n.props),
      cols: typedColumns(n.props, NODE_BASE),
    };
    nodes.set(n.id, { ...base, sig: sig(base) });
  }
  const edges = new Map<string, EdgeRow>();
  for (const e of graph.edges()) {
    const base = { id: e.id, type: e.type, source: e.source, target: e.target, sign: e.sign, heading: e.heading, props: json(e.props), cols: typedColumns(e.props, new Set()) };
    edges.set(e.id, { ...base, sig: sig(base) });
  }
  return { nodes, edges };
}

/**
 * Difference between what the mirror holds and the graph. Applying it in the
 * order delete edges, delete nodes, upsert nodes, insert edges keeps every
 * edge's endpoints present.
 */
// @lat: [[ladybug-mirror#One-way mirror]]
export function diffMirror(state: MirrorState, rows: ReturnType<typeof graphRows>): MirrorDiff {
  const diff: MirrorDiff = { deleteEdges: [], deleteNodes: [], upsertNodes: [], existingNodes: new Set(), insertEdges: [] };
  for (const [id, cur] of state.edges) {
    const want = rows.edges.get(id);
    if (!want || want.sig !== cur.sig) diff.deleteEdges.push({ id, type: cur.type });
  }
  for (const id of state.nodes.keys()) if (!rows.nodes.has(id)) diff.deleteNodes.push(id);
  for (const [id, row] of rows.nodes) {
    const cur = state.nodes.get(id);
    if (cur === row.sig) continue;
    diff.upsertNodes.push(row);
    if (cur !== undefined) diff.existingNodes.add(id);
  }
  for (const [id, row] of rows.edges) if (state.edges.get(id)?.sig !== row.sig) diff.insertEdges.push(row);
  return diff;
}

export function isEmptyDiff(d: MirrorDiff): boolean {
  return d.deleteEdges.length + d.deleteNodes.length + d.upsertNodes.length + d.insertEdges.length === 0;
}

/** State after a diff has been applied. */
export function applyToState(state: MirrorState, d: MirrorDiff): void {
  for (const e of d.deleteEdges) state.edges.delete(e.id);
  for (const id of d.deleteNodes) state.nodes.delete(id);
  for (const n of d.upsertNodes) state.nodes.set(n.id, n.sig);
  for (const e of d.insertEdges) state.edges.set(e.id, { sig: e.sig, type: e.type });
}

/** Relationship table for an edge type; `Node` is reserved for the node table. */
export function relTable(type: string): string {
  return type.toLowerCase() === 'node' ? `${type}_` : type;
}

/** Inverse of {@link relTable}. */
export function typeOfTable(table: string): string {
  return table.endsWith('_') && table.slice(0, -1).toLowerCase() === 'node' ? table.slice(0, -1) : table;
}
