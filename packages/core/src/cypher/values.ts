import type { GraphEdge, GraphNode } from '../graph/graph.js';

/** A node in a query result or binding. */
export class NodeRef {
  constructor(readonly node: GraphNode) {}
  get id(): string {
    return this.node.id;
  }
}

/** A relationship in a query result or binding. */
export class RelRef {
  constructor(readonly edge: GraphEdge) {}
  get id(): string {
    return this.edge.id;
  }
}

export type Value =
  | null
  | boolean
  | number
  | string
  | NodeRef
  | RelRef
  | Value[]
  | { [key: string]: Value };

export function isMap(v: Value): v is { [key: string]: Value } {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof NodeRef) && !(v instanceof RelRef);
}

/** Convert host data (frontmatter, edge props) into a query value. */
export function toValue(x: unknown): Value {
  if (x === undefined || x === null) return null;
  if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return x;
  if (x instanceof NodeRef || x instanceof RelRef) return x;
  if (x instanceof Date) return x.toISOString();
  if (Array.isArray(x)) return x.map(toValue);
  if (typeof x === 'object') {
    const out: { [key: string]: Value } = {};
    for (const [k, v] of Object.entries(x)) out[k] = toValue(v);
    return out;
  }
  return String(x);
}
