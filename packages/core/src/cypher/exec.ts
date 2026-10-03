import type { Graph, GraphEdge } from '../graph/graph.js';
import type { Expr, NodePattern, Pattern, Query } from './ast.js';
import { CypherError } from './lexer.js';
import { isMap, NodeRef, RelRef, toValue, type Value } from './values.js';

export type ColumnKind = 'node' | 'relationship' | 'scalar';

export interface Column {
  name: string;
  kind: ColumnKind;
}

/** Engine-independent result contract shared by every query backend. */
export interface QueryResult {
  columns: Column[];
  rows: Value[][];
}

type Env = Map<string, Value>;
type Params = Record<string, unknown>;

const runtime = (msg: string) => new CypherError('runtime', msg, 0, 0);

/** Execute a parsed query against the graph. Never mutates the graph. */
// @lat: [[query-engine#Two backends]]
export function execute(graph: Graph, q: Query, params: Params = {}): QueryResult {
  const kinds = new Map<string, ColumnKind>();
  for (const m of q.matches) {
    for (const p of m.patterns) {
      for (const n of p.nodes) declare(kinds, n.var, 'node');
      for (const r of p.rels) declare(kinds, r.var, 'relationship');
    }
  }

  const ctx = new Ctx(graph, params);
  const items = q.star
    ? [...kinds.keys()].filter((v) => !v.startsWith(' ')).map((v) => ({ name: v, expr: { k: 'var', name: v, line: 0, column: 0 } as Expr }))
        .concat(q.items)
    : q.items;
  if (items.length === 0) throw new CypherError('syntax', 'RETURN * requires at least one named variable', 1, 1);

  // Static variable checks, so errors surface even when nothing matches.
  const visible = new Set([...kinds.keys()]);
  for (const m of q.matches) if (m.where) checkVars(m.where, visible);
  for (const it of items) checkVars(it.expr, visible);
  const aliases = new Set([...visible, ...items.map((i) => i.name)]);
  for (const o of q.order) checkVars(o.expr, aliases);

  // MATCH ... WHERE
  let rows: Env[] = [new Map()];
  for (const clause of q.matches) {
    const out: Env[] = [];
    for (const row of rows) {
      matchPatterns(ctx, row, clause.patterns, 0, new Set(), (env) => {
        if (!clause.where || ctx.eval(clause.where, env) === true) out.push(new Map(env));
      });
    }
    rows = out;
  }

  // RETURN projection
  let projected = rows.map((env) => ({ env, values: items.map((it) => ctx.eval(it.expr, env)) }));
  if (q.distinct) {
    const seen = new Set<string>();
    projected = projected.filter((r) => {
      const key = keyOf(r.values);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (q.order.length > 0) {
    const keyed = projected.map((r) => {
      const env = new Map(r.env);
      items.forEach((it, idx) => env.set(it.name, r.values[idx]!));
      return { r, keys: q.order.map((o) => ctx.eval(o.expr, env)) };
    });
    keyed.sort((a, b) => {
      for (let i = 0; i < q.order.length; i++) {
        const c = orderCompare(a.keys[i]!, b.keys[i]!);
        if (c !== 0) return q.order[i]!.desc ? -c : c;
      }
      return 0;
    });
    projected = keyed.map((k) => k.r);
  }

  const skip = q.skip ? count(ctx.eval(q.skip, new Map()), 'SKIP') : 0;
  const limit = q.limit ? count(ctx.eval(q.limit, new Map()), 'LIMIT') : Infinity;
  projected = projected.slice(skip, skip + limit);

  return {
    columns: items.map((it) => ({
      name: it.name,
      kind: it.expr.k === 'var' ? (kinds.get(it.expr.name) ?? 'scalar') : 'scalar',
    })),
    rows: projected.map((r) => r.values),
  };
}

function declare(kinds: Map<string, ColumnKind>, name: string, kind: ColumnKind): void {
  const prev = kinds.get(name);
  if (prev && prev !== kind) {
    throw new CypherError('syntax', `Variable \`${name}\` is used as both a node and a relationship`, 1, 1);
  }
  kinds.set(name, kind);
}

function checkVars(e: Expr, known: Set<string>): void {
  switch (e.k) {
    case 'var':
      if (!known.has(e.name)) throw new CypherError('syntax', `Variable \`${e.name}\` not defined`, e.line, e.column);
      return;
    case 'prop':
    case 'labels':
      return checkVars(e.obj, known);
    case 'index':
      checkVars(e.obj, known);
      return checkVars(e.idx, known);
    case 'list':
      return e.items.forEach((i) => checkVars(i, known));
    case 'map':
      return e.entries.forEach(([, v]) => checkVars(v, known));
    case 'call':
      return e.args.forEach((a) => checkVars(a, known));
    case 'not':
    case 'neg':
    case 'isnull':
      return checkVars(e.e, known);
    case 'bin':
      checkVars(e.l, known);
      return checkVars(e.r, known);
    default:
      return;
  }
}

function count(v: Value, clause: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw runtime(`${clause} must be a non-negative integer`);
  return v;
}

// ---- pattern matching -------------------------------------------------------

function matchPatterns(ctx: Ctx, env: Env, patterns: Pattern[], pi: number, used: Set<string>, emit: (env: Env) => void): void {
  if (pi === patterns.length) return emit(env);
  const p = patterns[pi]!;
  const first = p.nodes[0]!;
  const bound = env.get(first.var);
  const candidates = bound !== undefined ? [bound] : ctx.allNodes();
  for (const c of candidates) {
    if (!(c instanceof NodeRef) || !ctx.nodeMatches(c, first, env)) continue;
    withBinding(env, first.var, c, () =>
      step(ctx, env, p, 0, c, used, () => matchPatterns(ctx, env, patterns, pi + 1, used, emit)),
    );
  }
}

function step(ctx: Ctx, env: Env, p: Pattern, ri: number, cur: NodeRef, used: Set<string>, done: () => void): void {
  if (ri === p.rels.length) return done();
  const rp = p.rels[ri]!;
  const np = p.nodes[ri + 1]!;
  for (const [edge, otherId] of ctx.incident(cur.id, rp.dir)) {
    // openCypher relationship uniqueness within one MATCH clause.
    if (used.has(edge.id)) continue;
    if (rp.types.length > 0 && !rp.types.includes(edge.type)) continue;
    const boundRel = env.get(rp.var);
    if (boundRel !== undefined && !(boundRel instanceof RelRef && boundRel.id === edge.id)) continue;
    const rel = ctx.rel(edge);
    if (!ctx.propsMatch(rel, rp.props, env)) continue;
    const other = ctx.node(otherId);
    if (!other) continue;
    const boundNode = env.get(np.var);
    if (boundNode !== undefined && !(boundNode instanceof NodeRef && boundNode.id === other.id)) continue;
    if (!ctx.nodeMatches(other, np, env)) continue;
    used.add(edge.id);
    withBinding(env, rp.var, rel, () =>
      withBinding(env, np.var, other, () => step(ctx, env, p, ri + 1, other, used, done)),
    );
    used.delete(edge.id);
  }
}

function withBinding(env: Env, name: string, v: Value, fn: () => void): void {
  const had = env.has(name);
  env.set(name, v);
  fn();
  if (!had) env.delete(name);
}

// ---- evaluation ---------------------------------------------------------------

class Ctx {
  private readonly nodeRefs = new Map<string, NodeRef>();
  private readonly relRefs = new Map<string, RelRef>();

  constructor(
    readonly graph: Graph,
    readonly params: Params,
  ) {}

  node(id: string): NodeRef | null {
    let ref = this.nodeRefs.get(id);
    if (!ref) {
      const n = this.graph.node(id);
      if (!n) return null;
      this.nodeRefs.set(id, (ref = new NodeRef(n)));
    }
    return ref;
  }
  rel(edge: GraphEdge): RelRef {
    let ref = this.relRefs.get(edge.id);
    if (!ref) this.relRefs.set(edge.id, (ref = new RelRef(edge)));
    return ref;
  }
  allNodes(): NodeRef[] {
    return [...this.graph.nodes()].map((n) => this.node(n.id)!);
  }
  incident(id: string, dir: 'out' | 'in' | 'both'): [GraphEdge, string][] {
    const out: [GraphEdge, string][] = dir === 'in' ? [] : this.graph.outEdges(id).map((e) => [e, e.target]);
    if (dir === 'out') return out;
    const seen = new Set(out.map(([e]) => e.id));
    for (const e of this.graph.inEdges(id)) if (!seen.has(e.id)) out.push([e, e.source]);
    return out;
  }
  nodeMatches(n: NodeRef, np: NodePattern, env: Env): boolean {
    return np.labels.every((l) => n.node.labels.includes(l)) && this.propsMatch(n, np.props, env);
  }
  propsMatch(target: NodeRef | RelRef, props: [string, Expr][], env: Env): boolean {
    return props.every(([k, e]) => equals(property(target, k), this.eval(e, env)) === true);
  }

  // @lat: [[query-engine#Supported subset]]
  eval(e: Expr, env: Env): Value {
    switch (e.k) {
      case 'lit':
        return e.v;
      case 'param':
        if (!(e.name in this.params)) throw runtime(`Missing parameter $${e.name}`);
        return toValue(this.params[e.name]);
      case 'var':
        return env.get(e.name) ?? null;
      case 'prop': {
        const o = this.eval(e.obj, env);
        if (o === null) return null;
        if (o instanceof NodeRef || o instanceof RelRef) return property(o, e.key);
        if (isMap(o)) return o[e.key] ?? null;
        throw runtime(`Cannot read property '${e.key}' of ${typeName(o)}`);
      }
      case 'index': {
        const o = this.eval(e.obj, env);
        const i = this.eval(e.idx, env);
        if (o === null || i === null) return null;
        if (Array.isArray(o) && typeof i === 'number') return o[i < 0 ? o.length + i : i] ?? null;
        if (isMap(o) && typeof i === 'string') return o[i] ?? null;
        if ((o instanceof NodeRef || o instanceof RelRef) && typeof i === 'string') return property(o, i);
        throw runtime(`Cannot index ${typeName(o)} with ${typeName(i)}`);
      }
      case 'labels': {
        const o = this.eval(e.obj, env);
        if (o === null) return null;
        if (!(o instanceof NodeRef)) throw runtime(`Label predicate requires a node, got ${typeName(o)}`);
        return e.labels.every((l) => o.node.labels.includes(l));
      }
      case 'list':
        return e.items.map((i) => this.eval(i, env));
      case 'map': {
        const m: { [k: string]: Value } = {};
        for (const [k, v] of e.entries) m[k] = this.eval(v, env);
        return m;
      }
      case 'call':
        return this.call(e.name, e.args.map((a) => this.eval(a, env)));
      case 'not': {
        const v = this.eval(e.e, env);
        return v === null ? null : !truthy(v);
      }
      case 'neg': {
        const v = this.eval(e.e, env);
        if (v === null) return null;
        if (typeof v !== 'number') throw runtime(`Cannot negate ${typeName(v)}`);
        return -v;
      }
      case 'isnull': {
        const isNull = this.eval(e.e, env) === null;
        return e.not ? !isNull : isNull;
      }
      case 'bin':
        return this.binary(e.op, e.l, e.r, env);
    }
  }

  private binary(op: string, le: Expr, re: Expr, env: Env): Value {
    if (op === 'and' || op === 'or' || op === 'xor') {
      const l = this.eval(le, env);
      if (op === 'and' && l === false) return false;
      if (op === 'or' && l === true) return true;
      const r = this.eval(re, env);
      const lb = l === null ? null : truthy(l);
      const rb = r === null ? null : truthy(r);
      if (op === 'and') return lb === false || rb === false ? false : lb === null || rb === null ? null : true;
      if (op === 'or') return lb === true || rb === true ? true : lb === null || rb === null ? null : false;
      return lb === null || rb === null ? null : lb !== rb;
    }
    const l = this.eval(le, env);
    const r = this.eval(re, env);
    switch (op) {
      case '=':
        return equals(l, r);
      case '<>': {
        const eq = equals(l, r);
        return eq === null ? null : !eq;
      }
      case '<':
      case '>':
      case '<=':
      case '>=': {
        const c = compare(l, r);
        if (c === null) return null;
        return op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
      }
      case 'in': {
        if (r === null) return null;
        if (!Array.isArray(r)) throw runtime(`IN requires a list, got ${typeName(r)}`);
        let sawNull = false;
        for (const item of r) {
          const eq = equals(l, item);
          if (eq === true) return true;
          if (eq === null) sawNull = true;
        }
        return sawNull ? null : false;
      }
      case 'starts':
      case 'ends':
      case 'contains':
        if (typeof l !== 'string' || typeof r !== 'string') return null;
        return op === 'starts' ? l.startsWith(r) : op === 'ends' ? l.endsWith(r) : l.includes(r);
      case '+':
        if (l === null || r === null) return null;
        if (typeof l === 'number' && typeof r === 'number') return l + r;
        if (typeof l === 'string' && (typeof r === 'string' || typeof r === 'number')) return l + String(r);
        if (typeof r === 'string' && typeof l === 'number') return String(l) + r;
        if (Array.isArray(l)) return Array.isArray(r) ? [...l, ...r] : [...l, r];
        if (Array.isArray(r)) return [l, ...r];
        throw runtime(`Cannot add ${typeName(l)} and ${typeName(r)}`);
      default: {
        if (l === null || r === null) return null;
        if (typeof l !== 'number' || typeof r !== 'number') {
          throw runtime(`Operator ${op} requires numbers, got ${typeName(l)} and ${typeName(r)}`);
        }
        if (op === '-') return l - r;
        if (op === '*') return l * r;
        if (op === '/') return l / r;
        if (op === '%') return l % r;
        return l ** r;
      }
    }
  }

  private call(name: string, args: Value[]): Value {
    const a = args[0] ?? null;
    const str = (fn: (s: string) => Value): Value => {
      if (a === null) return null;
      if (typeof a !== 'string') throw runtime(`${name}() requires a string, got ${typeName(a)}`);
      return fn(a);
    };
    const num = (fn: (n: number) => Value): Value => {
      if (a === null) return null;
      if (typeof a !== 'number') throw runtime(`${name}() requires a number, got ${typeName(a)}`);
      return fn(a);
    };
    switch (name) {
      case 'id':
        return a instanceof NodeRef || a instanceof RelRef ? a.id : null;
      case 'type':
        return a instanceof RelRef ? a.edge.type : null;
      case 'labels':
        return a instanceof NodeRef ? [...a.node.labels] : null;
      case 'keys':
        if (a instanceof NodeRef) return Object.keys(a.node.props);
        if (a instanceof RelRef) return Object.keys(a.edge.props);
        return isMap(a) ? Object.keys(a) : null;
      case 'properties':
        if (a instanceof NodeRef) return toValue(a.node.props);
        if (a instanceof RelRef) return toValue(a.edge.props);
        return isMap(a) ? a : null;
      case 'startnode':
        return a instanceof RelRef ? this.node(a.edge.source) : null;
      case 'endnode':
        return a instanceof RelRef ? this.node(a.edge.target) : null;
      case 'tolower':
        return str((s) => s.toLowerCase());
      case 'toupper':
        return str((s) => s.toUpperCase());
      case 'trim':
        return str((s) => s.trim());
      case 'ltrim':
        return str((s) => s.trimStart());
      case 'rtrim':
        return str((s) => s.trimEnd());
      case 'replace':
        return str((s) => (typeof args[1] === 'string' && typeof args[2] === 'string' ? s.split(args[1]).join(args[2]) : null));
      case 'substring':
        return str((s) => {
          const start = args[1];
          const len = args[2];
          if (typeof start !== 'number') return null;
          return typeof len === 'number' ? s.substr(start, len) : s.substring(start);
        });
      case 'split':
        return str((s) => (typeof args[1] === 'string' ? s.split(args[1]) : null));
      case 'left':
        return str((s) => (typeof args[1] === 'number' ? s.slice(0, args[1]) : null));
      case 'right':
        return str((s) => (typeof args[1] === 'number' ? (args[1] === 0 ? '' : s.slice(-args[1])) : null));
      case 'size':
        if (a === null) return null;
        if (typeof a === 'string' || Array.isArray(a)) return a.length;
        throw runtime(`size() requires a string or list, got ${typeName(a)}`);
      case 'coalesce':
        return args.find((x) => x !== null) ?? null;
      case 'tostring':
        if (a === null) return null;
        if (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean') return String(a);
        throw runtime(`toString() cannot convert ${typeName(a)}`);
      case 'tointeger':
      case 'tofloat': {
        if (a === null) return null;
        const n = typeof a === 'number' ? a : typeof a === 'string' ? Number(a) : NaN;
        if (Number.isNaN(n)) return null;
        return name === 'tointeger' ? Math.trunc(n) : n;
      }
      case 'toboolean':
        if (typeof a === 'boolean') return a;
        if (typeof a === 'string') return a.toLowerCase() === 'true' ? true : a.toLowerCase() === 'false' ? false : null;
        return null;
      case 'abs':
        return num(Math.abs);
      case 'round':
        return num(Math.round);
      case 'floor':
        return num(Math.floor);
      case 'ceil':
        return num(Math.ceil);
      case 'sign':
        return num(Math.sign);
      case 'head':
        return Array.isArray(a) ? (a[0] ?? null) : null;
      case 'last':
        return Array.isArray(a) ? (a[a.length - 1] ?? null) : null;
      case 'reverse':
        if (typeof a === 'string') return [...a].reverse().join('');
        return Array.isArray(a) ? [...a].reverse() : null;
      default:
        throw runtime(`Unknown function ${name}()`);
    }
  }
}

/** Property access with built-ins: `n.stub`, `r.id`, `r.sign`. */
function property(target: NodeRef | RelRef, key: string): Value {
  if (target instanceof NodeRef) {
    if (key === 'stub') return target.node.stub;
    return toValue(target.node.props[key]);
  }
  if (key === 'id') return target.edge.id;
  if (key === 'sign') return target.edge.sign;
  return toValue(target.edge.props[key]);
}

function truthy(v: Value): boolean {
  if (typeof v === 'boolean') return v;
  throw runtime(`Expected a boolean, got ${typeName(v)}`);
}

function typeName(v: Value): string {
  if (v === null) return 'null';
  if (v instanceof NodeRef) return 'node';
  if (v instanceof RelRef) return 'relationship';
  if (Array.isArray(v)) return 'list';
  if (isMap(v)) return 'map';
  return typeof v;
}

/** openCypher equality: null when either side is null. */
export function equals(a: Value, b: Value): boolean | null {
  if (a === null || b === null) return null;
  if (a instanceof NodeRef || a instanceof RelRef) return b instanceof a.constructor && (b as NodeRef).id === a.id;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    let sawNull = false;
    for (let i = 0; i < a.length; i++) {
      const eq = equals(a[i]!, b[i]!);
      if (eq === false) return false;
      if (eq === null) sawNull = true;
    }
    return sawNull ? null : true;
  }
  if (isMap(a)) {
    if (!isMap(b)) return false;
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    let sawNull = false;
    for (const k of ka) {
      if (!(k in b)) return false;
      const eq = equals(a[k]!, b[k]!);
      if (eq === false) return false;
      if (eq === null) sawNull = true;
    }
    return sawNull ? null : true;
  }
  return a === b;
}

/** Comparison for `<`-style operators: null when the types are not comparable. */
function compare(a: Value, b: Value): number | null {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return null;
}

/** Total order for ORDER BY; nulls sort last ascending. */
function orderCompare(a: Value, b: Value): number {
  const rank = (v: Value) =>
    isMap(v) ? 0 : v instanceof NodeRef ? 1 : v instanceof RelRef ? 2 : Array.isArray(v) ? 3 : typeof v === 'string' ? 4 : typeof v === 'boolean' ? 5 : typeof v === 'number' ? 6 : 7;
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const c = orderCompare(a[i]!, b[i]!);
      if (c !== 0) return c;
    }
    return a.length - b.length;
  }
  if ((a instanceof NodeRef || a instanceof RelRef) && (b instanceof NodeRef || b instanceof RelRef)) {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }
  return compare(a, b) ?? 0;
}

function keyOf(v: Value): string {
  return JSON.stringify(v, (_k, x) => (x instanceof NodeRef ? `\u0000N:${x.id}` : x instanceof RelRef ? `\u0000R:${x.id}` : x));
}
