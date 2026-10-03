import type { ColumnKind, JsonNode, JsonPath, JsonRelationship, JsonValue } from '@obsigraph/core';
import { typeOfTable } from '../mirror/rows.mjs';

type Raw = Record<string, unknown>;

const isObj = (x: unknown): x is Raw => typeof x === 'object' && x !== null && !Array.isArray(x);

function props(raw: unknown): Record<string, JsonValue> {
  if (typeof raw !== 'string') return {};
  try {
    return JSON.parse(raw) as Record<string, JsonValue>;
  } catch {
    return {};
  }
}

function node(n: Raw): JsonNode {
  return { _type: 'node', id: String(n.id), labels: (n.labels as string[]) ?? [], stub: Boolean(n.stub), properties: props(n.props) };
}

function rel(r: Raw): JsonRelationship {
  return {
    _type: 'relationship',
    id: String(r.id),
    type: typeOfTable(String(r._label)),
    sign: Number(r.sign) < 0 ? -1 : 1,
    source: String(r.src),
    target: String(r.dst),
    properties: props(r.props),
  };
}

/** Convert a LadybugDB value into the plugin's JSON wire form. */
// @lat: [[sidecar#Interfaces]]
export function fromLadybug(v: unknown): JsonValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(fromLadybug);
  if (isObj(v)) {
    if (Array.isArray(v._nodes) && Array.isArray(v._rels)) {
      return { _type: 'path', nodes: (v._nodes as Raw[]).map(node), relationships: (v._rels as Raw[]).map(rel) } satisfies JsonPath as unknown as JsonValue;
    }
    if ('_src' in v && '_dst' in v && '_label' in v) return rel(v) as unknown as JsonValue;
    if (v._label === 'Node' && '_id' in v) return node(v) as unknown as JsonValue;
    return Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('_')).map(([k, x]) => [k, fromLadybug(x)]));
  }
  return String(v);
}

/** Column kind from values, for queries passed through untranslated. */
export function inferKind(values: JsonValue[]): ColumnKind {
  const first = values.find((x) => x !== null) as Raw | undefined;
  if (!isObj(first)) return 'scalar';
  return first._type === 'node' ? 'node' : first._type === 'relationship' ? 'relationship' : first._type === 'path' ? 'path' : 'scalar';
}
