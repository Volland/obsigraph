import type { Graph, GraphEdge, GraphNode, ResolvedEdgeStyle, ResolvedNodeStyle } from '@obsigraph/core';
import { nodeElement, type EdgeElement, type GraphElements } from './elements';

/** A node, its incident edges in both directions, and its direct neighbors. */
// @lat: [[visualization#Surfaces]]
// @tg: implements:: [[openspec:graph-ui#Neighborhood view-state]]
export function neighborhood(graph: Graph, id: string): GraphElements {
  const center = graph.node(id);
  if (!center) return { nodes: [], edges: [] };
  const nodes = new Map([[id, nodeElement(center)]]);
  const edges: EdgeElement[] = [];
  for (const e of [...graph.outEdges(id), ...graph.inEdges(id)]) {
    const otherId = e.source === id ? e.target : e.source;
    const other = graph.node(otherId);
    if (!other) continue;
    if (!nodes.has(otherId)) nodes.set(otherId, nodeElement(other));
    if (!edges.some((x) => x.id === e.id)) edges.push(edgeElement(e));
  }
  return { nodes: [...nodes.values()], edges };
}

/** Union of element sets; the first occurrence of an id wins. */
// @tg: implements:: [[openspec:graph-ui#Neighborhood view-state]]
export function mergeElements(...sets: GraphElements[]): GraphElements {
  const nodes = new Map<string, GraphElements['nodes'][number]>();
  const edges = new Map<string, EdgeElement>();
  for (const s of sets) {
    for (const n of s.nodes) if (!nodes.has(n.id)) nodes.set(n.id, n);
    for (const e of s.edges) if (!edges.has(e.id)) edges.set(e.id, e);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export interface Details {
  title: string;
  rows: [string, string][];
}

/** Rows naming each resolved style attribute and the source that supplied it. */
// @lat: [[visualization#Styling]]
export function styleRows(style: ResolvedNodeStyle | ResolvedEdgeStyle): [string, string][] {
  return Object.entries(style.origin).map(([attr, origin]) => {
    const value = (style as unknown as Record<string, unknown>)[attr];
    return [`style.${attr}`, `${value ?? '—'} · ${origin}`];
  });
}

// @tg: implements:: [[openspec:graph-view#Selection details]]
export function nodeDetails(n: GraphNode, style?: ResolvedNodeStyle): Details {
  const rows: [string, string][] = [
    ['labels', n.labels.join(', ') || '—'],
    ['stub', String(n.stub)],
  ];
  for (const [k, v] of Object.entries(n.props)) if (k !== 'title') rows.push([k, show(v)]);
  if (style) rows.push(...styleRows(style));
  return { title: String(n.props.title ?? n.id), rows };
}

// @tg: implements:: [[openspec:graph-view#Selection details]]
export function edgeDetails(e: GraphEdge, graph: Graph, style?: ResolvedEdgeStyle): Details {
  const title = (id: string) => String(graph.node(id)?.props.title ?? id);
  const rows: [string, string][] = [
    ['type', e.type],
    ['sign', e.sign < 0 ? '-1 (negative)' : '+1'],
    ['id', e.id],
    ['from', title(e.source)],
    ['to', title(e.target)],
  ];
  if (e.heading) rows.push(['heading', e.heading]);
  for (const [k, v] of Object.entries(e.props)) if (k !== 'id') rows.push([k, show(v)]);
  if (style) rows.push(...styleRows(style));
  return { title: `${title(e.source)} ${e.sign < 0 ? '−' : ''}${e.type} → ${title(e.target)}`, rows };
}

function edgeElement(e: GraphEdge): EdgeElement {
  return { id: e.id, source: e.source, target: e.target, type: e.type, sign: e.sign };
}

function show(v: unknown): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}
