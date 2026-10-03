import type { QueryResult } from './exec.js';
import { NodeRef, PathRef, RelRef, isMap, type Value } from './values.js';

/** JSON wire form of query values; graph values carry a `_type` tag. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface JsonNode {
  _type: 'node';
  id: string;
  labels: string[];
  stub: boolean;
  properties: Record<string, JsonValue>;
}

export interface JsonRelationship {
  _type: 'relationship';
  id: string;
  type: string;
  sign: 1 | -1;
  source: string;
  target: string;
  properties: Record<string, JsonValue>;
}

export interface JsonPath {
  _type: 'path';
  nodes: JsonNode[];
  relationships: JsonRelationship[];
}

export interface JsonQueryResult {
  columns: QueryResult['columns'];
  rows: JsonValue[][];
  notices?: string[];
}

function plain(x: unknown): JsonValue {
  if (x === undefined || x === null) return null;
  if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return x;
  if (x instanceof Date) return x.toISOString();
  if (Array.isArray(x)) return x.map(plain);
  if (typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, plain(v)]));
  return String(x);
}

function node(n: NodeRef): JsonNode {
  return { _type: 'node', id: n.id, labels: [...n.node.labels], stub: n.node.stub, properties: plain(n.node.props) as Record<string, JsonValue> };
}

function rel(r: RelRef): JsonRelationship {
  const e = r.edge;
  return { _type: 'relationship', id: e.id, type: e.type, sign: e.sign, source: e.source, target: e.target, properties: plain(e.props) as Record<string, JsonValue> };
}

/** Serialize a query value for HTTP or MCP. */
// @lat: [[sidecar#Interfaces]]
export function toJsonValue(v: Value): JsonValue {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof NodeRef) return node(v) as unknown as JsonValue;
  if (v instanceof RelRef) return rel(v) as unknown as JsonValue;
  if (v instanceof PathRef) return { _type: 'path', nodes: v.nodes.map(node), relationships: v.rels.map(rel) } as unknown as JsonValue;
  if (Array.isArray(v)) return v.map(toJsonValue);
  if (isMap(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toJsonValue(x)]));
  return null;
}

export function resultToJson(r: QueryResult): JsonQueryResult {
  const out: JsonQueryResult = { columns: r.columns, rows: r.rows.map((row) => row.map(toJsonValue)) };
  if (r.notices) out.notices = r.notices;
  return out;
}

function nodeFrom(n: JsonNode): NodeRef {
  return new NodeRef({ id: n.id, labels: [...n.labels], stub: n.stub, props: { ...n.properties } });
}

function relFrom(r: JsonRelationship): RelRef {
  return new RelRef({ id: r.id, type: r.type, sign: r.sign, source: r.source, target: r.target, props: { ...r.properties } as never, heading: null, line: 0 });
}

/** Inverse of {@link toJsonValue}: rebuild graph values from the wire form. */
export function fromJsonValue(v: JsonValue): Value {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(fromJsonValue);
  const tag = (v as { _type?: unknown })._type;
  if (tag === 'node') return nodeFrom(v as unknown as JsonNode);
  if (tag === 'relationship') return relFrom(v as unknown as JsonRelationship);
  if (tag === 'path') {
    const p = v as unknown as JsonPath;
    return new PathRef(p.nodes.map(nodeFrom), p.relationships.map(relFrom));
  }
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fromJsonValue(x)]));
}

/** Rebuild a query result received from a remote backend. */
// @lat: [[sidecar#Interfaces]]
export function resultFromJson(r: JsonQueryResult): QueryResult {
  const out: QueryResult = { columns: r.columns, rows: r.rows.map((row) => row.map(fromJsonValue)) };
  if (r.notices) out.notices = r.notices;
  return out;
}
