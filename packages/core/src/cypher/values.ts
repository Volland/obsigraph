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

/** A path: alternating nodes and relationships, `nodes.length === rels.length + 1`. */
export class PathRef {
  constructor(
    readonly nodes: NodeRef[],
    readonly rels: RelRef[],
  ) {}
  get id(): string {
    return [this.nodes[0]?.id ?? '', ...this.rels.map((r) => r.id)].join('|');
  }
}

export type Value =
  | null
  | boolean
  | number
  | string
  | NodeRef
  | RelRef
  | PathRef
  | Value[]
  | { [key: string]: Value };

export function isMap(v: Value): v is { [key: string]: Value } {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof NodeRef) && !(v instanceof RelRef) && !(v instanceof PathRef);
}

/** Convert host data (frontmatter, edge props) into a query value. */
export function toValue(x: unknown): Value {
  if (x === undefined || x === null) return null;
  if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return x;
  if (x instanceof NodeRef || x instanceof RelRef || x instanceof PathRef) return x;
  if (x instanceof Date) return x.toISOString();
  if (Array.isArray(x)) return x.map(toValue);
  if (typeof x === 'object') {
    const out: { [key: string]: Value } = {};
    for (const [k, v] of Object.entries(x)) out[k] = toValue(v);
    return out;
  }
  return String(x);
}
