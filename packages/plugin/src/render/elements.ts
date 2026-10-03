import { NodeRef, RelRef, type GraphNode, type QueryResult, type Value } from '@obsigraph/core';

export interface NodeElement {
  id: string;
  label: string;
  labels: string[];
  stub: boolean;
  path: string | null;
}

export interface EdgeElement {
  id: string;
  source: string;
  target: string;
  type: string;
  sign: 1 | -1;
}

export interface GraphElements {
  nodes: NodeElement[];
  edges: EdgeElement[];
}

export function nodeElement(n: GraphNode): NodeElement {
  const title = n.props.title;
  return {
    id: n.id,
    label: typeof title === 'string' ? title : n.id,
    labels: [...n.labels],
    stub: n.stub,
    path: n.stub ? null : n.id,
  };
}

/**
 * Collect the nodes and relationships in a result, including values nested in
 * lists, and add relationship endpoints so every edge can be drawn.
 */
export function toElements(result: QueryResult, lookup: (id: string) => GraphNode | undefined): GraphElements {
  const nodes = new Map<string, NodeElement>();
  const edges = new Map<string, EdgeElement>();

  const visit = (v: Value): void => {
    if (v instanceof NodeRef) {
      if (!nodes.has(v.id)) nodes.set(v.id, nodeElement(v.node));
    } else if (v instanceof RelRef) {
      const e = v.edge;
      if (edges.has(e.id)) return;
      edges.set(e.id, { id: e.id, source: e.source, target: e.target, type: e.type, sign: e.sign });
      for (const end of [e.source, e.target]) {
        const n = nodes.has(end) ? undefined : lookup(end);
        if (n) nodes.set(end, nodeElement(n));
      }
    } else if (Array.isArray(v)) {
      v.forEach(visit);
    }
  };

  for (const row of result.rows) row.forEach(visit);
  // Drop edges whose endpoint vanished, so the renderer never sees a dangling edge.
  for (const [id, e] of edges) if (!nodes.has(e.source) || !nodes.has(e.target)) edges.delete(id);
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export function elementCount(g: GraphElements): number {
  return g.nodes.length + g.edges.length;
}
