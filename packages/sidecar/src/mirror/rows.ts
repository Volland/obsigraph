import { createHash } from 'node:crypto';
import type { Graph } from '@obsigraph/core';

export interface NodeRow {
  id: string;
  labels: string[];
  title: string;
  path: string | null;
  stub: boolean;
  /** Node properties as JSON (frontmatter, path, title). */
  props: string;
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
    };
    nodes.set(n.id, { ...base, sig: sig(base) });
  }
  const edges = new Map<string, EdgeRow>();
  for (const e of graph.edges()) {
    const base = { id: e.id, type: e.type, source: e.source, target: e.target, sign: e.sign, heading: e.heading, props: json(e.props) };
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
