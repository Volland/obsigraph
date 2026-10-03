import type { Graph, GraphEdge } from '../graph/graph.js';
import type { Expr, NodePattern, Pattern, Projection, Query, ReturnItem } from './ast.js';
import { containsAgg } from './parser.js';
import { CypherError } from './lexer.js';
import { isMap, NodeRef, PathRef, RelRef, toValue, type Value } from './values.js';

export type ColumnKind = 'node' | 'relationship' | 'path' | 'scalar';

export interface Column {
  name: string;
  kind: ColumnKind;
}

/** Engine-independent result contract shared by every query backend. */
export interface QueryResult {
  columns: Column[];
  rows: Value[][];
  /** Non-fatal notes, e.g. that a variable-length expansion hit the depth cap. */
  notices?: string[];
}

export interface ExecOptions {
  /** Depth cap for unbounded variable-length relationships (`*`, `*n..`). */
  maxPathDepth?: number;
  /** Abort with a timeout error after this many milliseconds. */
  timeoutMs?: number;
}

export const DEFAULT_MAX_PATH_DEPTH = 10;

type Env = Map<string, Value>;
type Params = Record<string, unknown>;
type Scope = Map<string, ColumnKind>;

const runtime = (msg: string) => new CypherError('runtime', msg, 0, 0);
const varExpr = (name: string): Expr => ({ k: 'var', name, line: 0, column: 0 });

/** Execute a parsed query as a pipeline of clauses. Never mutates the graph. */
// @lat: [[query-engine#Two backends]]
export function execute(graph: Graph, q: Query, params: Params = {}, opts: ExecOptions = {}): QueryResult {
  const ctx = new Ctx(graph, params, opts.maxPathDepth ?? DEFAULT_MAX_PATH_DEPTH, opts.timeoutMs ? Date.now() + opts.timeoutMs : Infinity);
  const columns = analyze(q);
  let rows: Env[] = [new Map()];
  let scope: Scope = new Map();
  let result: Value[][] = [];

  for (const clause of q.clauses) {
    if (clause.k === 'match') {
      scope = declarePatterns(scope, clause.patterns);
      rows = runMatch(ctx, rows, clause.patterns, clause.where, clause.optional);
    } else {
      const items = projectionItems(clause.proj, scope);
      const projected = project(ctx, clause.proj, items, rows);
      if (clause.k === 'return') {
        result = projected.map((r) => r.values);
        break;
      }
      scope = new Map(items.map((it) => [it.name, kindOf(it.expr, scope)]));
      rows = projected.map((r) => new Map(items.map((it, i) => [it.name, r.values[i]!])));
      if (clause.proj.where) rows = rows.filter((env) => ctx.eval(clause.proj.where!, env) === true);
    }
  }

  const out: QueryResult = { columns, rows: result };
  if (ctx.notices.size > 0) out.notices = [...ctx.notices];
  return out;
}

// ---- static analysis --------------------------------------------------------

/** Check variable scoping through every clause and return the RETURN columns. */
function analyze(q: Query): Column[] {
  let scope: Scope = new Map();
  for (const clause of q.clauses) {
    if (clause.k === 'match') {
      scope = declarePatterns(scope, clause.patterns);
      for (const p of clause.patterns) {
        for (const n of p.nodes) n.props.forEach(([, e]) => checkVars(e, scope));
        for (const r of p.rels) r.props.forEach(([, e]) => checkVars(e, scope));
      }
      if (clause.where) checkVars(clause.where, scope);
      continue;
    }
    const items = projectionItems(clause.proj, scope);
    for (const it of items) checkVars(it.expr, scope);
    const withAliases = new Set([...scope.keys(), ...items.map((i) => i.name)]);
    for (const o of clause.proj.order) checkVars(o.expr, withAliases);
    if (clause.proj.skip) checkVars(clause.proj.skip, new Set());
    if (clause.proj.limit) checkVars(clause.proj.limit, new Set());
    const next: Scope = new Map(items.map((it) => [it.name, kindOf(it.expr, scope)]));
    if (clause.k === 'return') return items.map((it) => ({ name: it.name, kind: next.get(it.name)! }));
    if (clause.proj.where) checkVars(clause.proj.where, next);
    scope = next;
  }
  throw new CypherError('syntax', 'Query must end with RETURN', 1, 1);
}

function declarePatterns(scope: Scope, patterns: Pattern[]): Scope {
  const next = new Map(scope);
  const declare = (name: string, kind: ColumnKind) => {
    const prev = next.get(name);
    if (prev && prev !== kind) throw new CypherError('syntax', `Variable \`${name}\` is already bound as a ${prev}`, 1, 1);
    next.set(name, kind);
  };
  for (const p of patterns) {
    for (const n of p.nodes) declare(n.var, 'node');
    for (const r of p.rels) declare(r.var, 'relationship');
    if (p.pathVar) declare(p.pathVar, 'path');
  }
  return next;
}

function projectionItems(proj: Projection, scope: Scope): ReturnItem[] {
  const items = proj.star
    ? [...scope.keys()].filter((v) => !v.startsWith(' ')).map((v) => ({ name: v, expr: varExpr(v) })).concat(proj.items)
    : proj.items;
  if (items.length === 0) throw new CypherError('syntax', '* requires at least one named variable in scope', 1, 1);
  return items;
}

function kindOf(e: Expr, scope: Scope): ColumnKind {
  return e.k === 'var' ? (scope.get(e.name) ?? 'scalar') : 'scalar';
}

function checkVars(e: Expr, known: { has(name: string): boolean }): void {
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
    case 'agg':
      if (e.arg) checkVars(e.arg, known);
      return;
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

// ---- projection (WITH / RETURN) ----------------------------------------------

function collectAggs(e: Expr, out: Expr[]): void {
  switch (e.k) {
    case 'agg':
      out.push(e);
      return;
    case 'prop':
    case 'labels':
      return collectAggs(e.obj, out);
    case 'index':
      collectAggs(e.obj, out);
      return collectAggs(e.idx, out);
    case 'list':
      return e.items.forEach((i) => collectAggs(i, out));
    case 'map':
      return e.entries.forEach(([, v]) => collectAggs(v, out));
    case 'call':
      return e.args.forEach((a) => collectAggs(a, out));
    case 'not':
    case 'neg':
    case 'isnull':
      return collectAggs(e.e, out);
    case 'bin':
      collectAggs(e.l, out);
      return collectAggs(e.r, out);
    default:
      return;
  }
}

/**
 * Project rows for WITH or RETURN. With aggregates, the non-aggregate items
 * are grouping keys; without grouping keys, zero rows still yield one row.
 */
// @lat: [[query-engine#Supported subset]]
function project(ctx: Ctx, proj: Projection, items: ReturnItem[], rows: Env[]): { values: Value[]; env: Env }[] {
  const aggs: Expr[] = [];
  for (const it of items) collectAggs(it.expr, aggs);
  const orderAggs: Expr[] = [];
  for (const o of proj.order) collectAggs(o.expr, orderAggs);

  type Out = { values: Value[]; env: Env; aggValues: Map<Expr, Value> };
  let out: Out[];
  if (aggs.length === 0 && orderAggs.length === 0) {
    out = rows.map((env) => ({ env, values: items.map((it) => ctx.eval(it.expr, env)), aggValues: new Map() }));
  } else {
    const keyItems = items.filter((it) => !containsAgg(it.expr));
    const groups = new Map<string, Env[]>();
    for (const env of rows) {
      const key = keyOf(keyItems.map((it) => ctx.eval(it.expr, env)));
      let g = groups.get(key);
      if (!g) groups.set(key, (g = []));
      g.push(env);
    }
    if (rows.length === 0 && keyItems.length === 0) groups.set('', []);
    out = [...groups.values()].map((group) => {
      const env = group[0] ?? new Map<string, Value>();
      const aggValues = new Map<Expr, Value>();
      for (const a of [...aggs, ...orderAggs]) aggValues.set(a, ctx.aggregate(a as Extract<Expr, { k: 'agg' }>, group));
      return { env, aggValues, values: ctx.withAggs(aggValues, () => items.map((it) => ctx.eval(it.expr, env))) };
    });
  }

  if (proj.distinct) {
    const seen = new Set<string>();
    out = out.filter((r) => {
      const key = keyOf(r.values);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (proj.order.length > 0) {
    const keyed = out.map((r) => {
      const env = new Map(r.env);
      items.forEach((it, idx) => env.set(it.name, r.values[idx]!));
      return { r, keys: ctx.withAggs(r.aggValues, () => proj.order.map((o) => ctx.eval(o.expr, env))) };
    });
    keyed.sort((a, b) => {
      for (let i = 0; i < proj.order.length; i++) {
        const c = orderCompare(a.keys[i]!, b.keys[i]!);
        if (c !== 0) return proj.order[i]!.desc ? -c : c;
      }
      return 0;
    });
    out = keyed.map((k) => k.r);
  }

  const skip = proj.skip ? count(ctx.eval(proj.skip, new Map()), 'SKIP') : 0;
  const limit = proj.limit ? count(ctx.eval(proj.limit, new Map()), 'LIMIT') : Infinity;
  return out.slice(skip, skip + limit);
}

// ---- pattern matching -------------------------------------------------------

/**
 * MATCH keeps rows with at least one match; OPTIONAL MATCH keeps rows without
 * one, binding the pattern's new variables to null.
 */
function runMatch(ctx: Ctx, rows: Env[], patterns: Pattern[], where: Expr | null, optional: boolean): Env[] {
  const out: Env[] = [];
  const introduced = new Set<string>();
  for (const p of patterns) {
    for (const n of p.nodes) introduced.add(n.var);
    for (const r of p.rels) introduced.add(r.var);
    if (p.pathVar) introduced.add(p.pathVar);
  }
  for (const row of rows) {
    let matched = false;
    matchPatterns(ctx, new Map(row), patterns, 0, new Set(), (env) => {
      if (!where || ctx.eval(where, env) === true) {
        out.push(new Map(env));
        matched = true;
      }
    });
    if (optional && !matched) {
      const env = new Map(row);
      for (const v of introduced) if (!env.has(v)) env.set(v, null);
      out.push(env);
    }
  }
  return out;
}

interface Trail {
  nodes: NodeRef[];
  rels: RelRef[];
}

function matchPatterns(ctx: Ctx, env: Env, patterns: Pattern[], pi: number, used: Set<string>, emit: (env: Env) => void): void {
  if (pi === patterns.length) return emit(env);
  const p = patterns[pi]!;
  const first = p.nodes[0]!;
  const bound = env.get(first.var);
  const candidates = bound !== undefined ? [bound] : ctx.allNodes();
  for (const c of candidates) {
    ctx.tick();
    if (!(c instanceof NodeRef) || !ctx.nodeMatches(c, first, env)) continue;
    withBinding(env, first.var, c, () =>
      step(ctx, env, p, 0, c, used, { nodes: [c], rels: [] }, () => {
        const next = () => matchPatterns(ctx, env, patterns, pi + 1, used, emit);
        if (p.pathVar) withBinding(env, p.pathVar, ctx.path(p, env), next);
        else next();
      }),
    );
  }
}

function step(ctx: Ctx, env: Env, p: Pattern, ri: number, cur: NodeRef, used: Set<string>, trail: Trail, done: () => void): void {
  if (ri === p.rels.length) {
    ctx.trails.set(p, trail);
    return done();
  }
  const rp = p.rels[ri]!;
  if (rp.length) return expand(ctx, env, p, ri, cur, used, trail, done);
  const np = p.nodes[ri + 1]!;
  for (const [edge, otherId] of ctx.incident(cur.id, rp.dir)) {
    ctx.tick();
    // openCypher relationship uniqueness within one MATCH clause.
    if (used.has(edge.id)) continue;
    if (rp.types.length > 0 && !rp.types.includes(edge.type)) continue;
    const boundRel = env.get(rp.var);
    if (boundRel !== undefined && !(boundRel instanceof RelRef && boundRel.id === edge.id)) continue;
    const rel = ctx.rel(edge);
    if (!ctx.propsMatch(rel, rp.props, env)) continue;
    const other = ctx.node(otherId);
    if (!other || !endOk(ctx, env, np, other)) continue;
    used.add(edge.id);
    withBinding(env, rp.var, rel, () =>
      withBinding(env, np.var, other, () =>
        step(ctx, env, p, ri + 1, other, used, { nodes: [...trail.nodes, other], rels: [...trail.rels, rel] }, done),
      ),
    );
    used.delete(edge.id);
  }
}

/**
 * Variable-length expansion: depth-first, never reusing a relationship, with
 * unbounded ranges capped at the configured depth (reported as a notice).
 */
// @lat: [[query-engine#Supported subset]]
function expand(ctx: Ctx, env: Env, p: Pattern, ri: number, start: NodeRef, used: Set<string>, trail: Trail, done: () => void): void {
  const rp = p.rels[ri]!;
  const np = p.nodes[ri + 1]!;
  const { min } = rp.length!;
  const max = rp.length!.max ?? ctx.maxDepth;
  const nodes: NodeRef[] = [];
  const rels: RelRef[] = [];
  const candidates = (id: string) =>
    ctx.incident(id, rp.dir).filter(([e]) => !used.has(e.id) && (rp.types.length === 0 || rp.types.includes(e.type)));

  const finish = (end: NodeRef) => {
    if (!endOk(ctx, env, np, end)) return;
    const relList = [...rels];
    const boundRel = env.get(rp.var);
    if (boundRel !== undefined && keyOf(boundRel) !== keyOf(relList)) return;
    withBinding(env, rp.var, relList, () =>
      withBinding(env, np.var, end, () =>
        step(ctx, env, p, ri + 1, end, used, { nodes: [...trail.nodes, ...nodes], rels: [...trail.rels, ...rels] }, done),
      ),
    );
  };

  const visit = (cur: NodeRef, depth: number) => {
    ctx.tick();
    if (depth >= min) finish(cur);
    const next = candidates(cur.id);
    if (depth >= max) {
      if (rp.length!.max === null && next.length > 0) ctx.notices.add(`Variable-length expansion stopped at the depth cap of ${max}; set an upper bound or raise the cap.`);
      return;
    }
    for (const [edge, otherId] of next) {
      const rel = ctx.rel(edge);
      if (!ctx.propsMatch(rel, rp.props, env)) continue;
      const other = ctx.node(otherId);
      if (!other) continue;
      used.add(edge.id);
      rels.push(rel);
      nodes.push(other);
      visit(other, depth + 1);
      nodes.pop();
      rels.pop();
      used.delete(edge.id);
    }
  };
  visit(start, 0);
}

function endOk(ctx: Ctx, env: Env, np: NodePattern, node: NodeRef): boolean {
  const bound = env.get(np.var);
  if (bound !== undefined && !(bound instanceof NodeRef && bound.id === node.id)) return false;
  return ctx.nodeMatches(node, np, env);
}

function withBinding(env: Env, name: string, v: Value, fn: () => void): void {
  const had = env.has(name);
  const prev = env.get(name);
  env.set(name, v);
  fn();
  if (had) env.set(name, prev!);
  else env.delete(name);
}

// ---- evaluation ---------------------------------------------------------------

class Ctx {
  private readonly nodeRefs = new Map<string, NodeRef>();
  private readonly relRefs = new Map<string, RelRef>();
  private aggValues: Map<Expr, Value> | null = null;
  readonly notices = new Set<string>();
  /** Node/relationship sequence of the most recently completed pattern match. */
  readonly trails = new Map<Pattern, Trail>();

  constructor(
    readonly graph: Graph,
    readonly params: Params,
    readonly maxDepth: number,
    private readonly deadline: number = Infinity,
  ) {}

  private ticks = 0;
  /** Cooperative cancellation: checked while matching, cheap between clock reads. */
  tick(): void {
    if (this.deadline === Infinity || ++this.ticks % 512 !== 0) return;
    if (Date.now() > this.deadline) throw new CypherError('timeout', 'Query timed out', 0, 0);
  }

  path(p: Pattern, _env: Env): PathRef {
    const t = this.trails.get(p)!;
    return new PathRef(t.nodes, t.rels);
  }

  /** Evaluate with precomputed aggregate values for the current group. */
  withAggs<T>(values: Map<Expr, Value>, fn: () => T): T {
    const prev = this.aggValues;
    this.aggValues = values;
    try {
      return fn();
    } finally {
      this.aggValues = prev;
    }
  }

  /** openCypher aggregation over a group; nulls ignored except by count(*). */
  aggregate(e: Extract<Expr, { k: 'agg' }>, group: Env[]): Value {
    if (e.arg === null) return group.length;
    let values = group.map((env) => this.eval(e.arg!, env)).filter((v) => v !== null);
    if (e.distinct) {
      const seen = new Set<string>();
      values = values.filter((v) => {
        const k = keyOf(v);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    switch (e.name) {
      case 'count':
        return values.length;
      case 'collect':
        return values;
      case 'sum':
      case 'avg': {
        let total = 0;
        for (const v of values) {
          if (typeof v !== 'number') {
            throw new CypherError('runtime', `${e.name}() requires numbers, got ${typeName(v)}`, e.line, e.column);
          }
          total += v;
        }
        if (e.name === 'sum') return total;
        return values.length === 0 ? null : total / values.length;
      }
      case 'min':
      case 'max': {
        if (values.length === 0) return null;
        return values.reduce((a, b) => {
          const c = orderCompare(a, b);
          return e.name === 'min' ? (c <= 0 ? a : b) : c >= 0 ? a : b;
        });
      }
    }
  }

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
      case 'agg': {
        const v = this.aggValues?.get(e);
        if (v === undefined) throw new CypherError('syntax', `Aggregation ${e.name}() is only allowed in WITH or RETURN`, e.line, e.column);
        return v;
      }
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
      case 'length':
        if (a instanceof PathRef) return a.rels.length;
        if (typeof a === 'string' || Array.isArray(a)) return a.length;
        return null;
      case 'nodes':
        return a instanceof PathRef ? [...a.nodes] : null;
      case 'relationships':
        return a instanceof PathRef ? [...a.rels] : null;
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
  if (v instanceof PathRef) return 'path';
  if (Array.isArray(v)) return 'list';
  if (isMap(v)) return 'map';
  return typeof v;
}

/** openCypher equality: null when either side is null. */
export function equals(a: Value, b: Value): boolean | null {
  if (a === null || b === null) return null;
  if (a instanceof NodeRef || a instanceof RelRef || a instanceof PathRef) return b instanceof a.constructor && (b as NodeRef).id === a.id;
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
    isMap(v) ? 0 : v instanceof NodeRef ? 1 : v instanceof RelRef ? 2 : Array.isArray(v) ? 3 : v instanceof PathRef ? 3.5 : typeof v === 'string' ? 4 : typeof v === 'boolean' ? 5 : typeof v === 'number' ? 6 : 7;
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
  if ((a instanceof NodeRef || a instanceof RelRef || a instanceof PathRef) && (b instanceof NodeRef || b instanceof RelRef || b instanceof PathRef)) {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }
  return compare(a, b) ?? 0;
}

function keyOf(v: Value): string {
  return JSON.stringify(v, (_k, x) =>
    x instanceof NodeRef ? `\u0000N:${x.id}` : x instanceof RelRef ? `\u0000R:${x.id}` : x instanceof PathRef ? `\u0000P:${x.id}` : x,
  );
}
