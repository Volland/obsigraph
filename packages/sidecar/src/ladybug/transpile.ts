import { CypherError, queryColumns, type Column, type ColumnKind, type Expr, type NodePattern, type Pattern, type Projection, type Query, type RelPattern } from '@obsigraph/core';
import { EMPTY_REL_TABLE, propColumn, relTable, type ColType, type PropertyTypes } from '../mirror/rows.js';

export interface TranspileContext {
  types: PropertyTypes;
  /** Edge-type tables that exist in the mirror. */
  tables: Set<string>;
  maxDepth: number;
}

export interface Transpiled {
  text: string;
  columns: Column[];
  /** Internal result keys, aligned with `columns`. */
  keys: string[];
  notices: string[];
}

type Kind = ColumnKind | 'rels';
const KIND_ORDER: ColType[] = ['n', 's', 'b', 'ls', 'ln', 'j'];
const NODE_BUILTIN = new Set(['title', 'path', 'stub']);
const REL_BUILTIN = new Set(['id', 'sign']);

const unsupported = (what: string) => new CypherError('unsupported', `${what} is not supported on the Ladybug backend`, 0, 0);

function ident(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `\`${name.replace(/`/g, '')}\``;
}

function str(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Translate a parsed query onto the mirror layout: label patterns become
 * label-list checks on `Node`, properties become typed columns, built-ins map
 * to base columns, and functions map to Ladybug equivalents. The query keeps
 * the plugin's semantics and column names.
 */
// @lat: [[ladybug-mirror#Storage layout]]
export function transpile(q: Query, ctx: TranspileContext): Transpiled {
  return new Transpiler(ctx).run(q);
}

class Transpiler {
  private scope = new Map<string, Kind>();
  private readonly names = new Map<string, string>();
  private anon = 0;
  readonly notices = new Set<string>();

  constructor(private readonly ctx: TranspileContext) {}

  run(q: Query): Transpiled {
    const columns = queryColumns(q);
    const parts: string[] = [];
    let keys: string[] = [];
    for (const c of q.clauses) {
      if (c.k === 'match') parts.push(this.match(c.patterns, c.where, c.optional));
      else if (c.k === 'with') parts.push(this.projection('WITH', c.proj));
      else {
        const r = this.projection('RETURN', c.proj, true);
        parts.push(r);
        keys = this.returnKeys;
      }
    }
    return { text: parts.join('\n'), columns, keys, notices: [...this.notices] };
  }

  // ---- clauses ------------------------------------------------------------

  private match(patterns: Pattern[], where: Expr | null, optional: boolean): string {
    const conds: string[] = [];
    const pats = patterns.map((p) => this.pattern(p, conds));
    if (where) conds.push(`(${this.expr(where)})`);
    return `${optional ? 'OPTIONAL ' : ''}MATCH ${pats.join(', ')}${conds.length ? ` WHERE ${conds.join(' AND ')}` : ''}`;
  }

  private pattern(p: Pattern, conds: string[]): string {
    let out = '';
    if (p.pathVar) {
      out += `${this.declare(p.pathVar, 'path')} = `;
    }
    out += this.node(p.nodes[0]!, conds);
    p.rels.forEach((r, i) => {
      out += this.rel(r, conds) + this.node(p.nodes[i + 1]!, conds);
    });
    return out;
  }

  private node(n: NodePattern, conds: string[]): string {
    const v = this.declare(n.var, 'node', n.anonymous);
    for (const l of n.labels) conds.push(`list_contains(${v}.labels, ${str(l)})`);
    for (const [k, e] of n.props) conds.push(`${this.property(v, 'node', k)} = ${this.expr(e)}`);
    return `(${v}:Node)`;
  }

  private rel(r: RelPattern, conds: string[]): string {
    const varLen = r.length !== null;
    const v = this.declare(r.var, varLen ? 'rels' : 'relationship', r.anonymous);
    let types = '';
    if (r.types.length > 0) {
      const tables = r.types.map(relTable).filter((t) => this.ctx.tables.has(t));
      types = `:${(tables.length ? tables : [EMPTY_REL_TABLE]).map(ident).join('|')}`;
    }
    let len = '';
    if (varLen) {
      const max = r.length!.max ?? this.ctx.maxDepth;
      if (r.length!.max === null) this.notices.add(`Unbounded variable-length patterns are capped at ${max} hops on the Ladybug backend.`);
      // TRAIL keeps openCypher's rule that a path never repeats a relationship.
      len = `* TRAIL ${r.length!.min}..${max}`;
      if (r.props.length) throw unsupported('A property map on a variable-length relationship');
    } else {
      for (const [k, e] of r.props) conds.push(`${this.property(v, 'relationship', k)} = ${this.expr(e)}`);
    }
    const body = `[${v}${types}${len}]`;
    return r.dir === 'out' ? `-${body}->` : r.dir === 'in' ? `<-${body}-` : `-${body}-`;
  }

  private returnKeys: string[] = [];

  private projection(kw: 'WITH' | 'RETURN', p: Projection, isReturn = false): string {
    const items = p.star
      ? [...this.scope.keys()].filter((v) => !v.startsWith(' ')).map((v): { name: string; expr: Expr } => ({ name: v, expr: { k: 'var', name: v, line: 0, column: 0 } })).concat(p.items)
      : p.items;
    const rendered = items.map((it) => this.expr(it.expr));
    const keys = isReturn ? items.map((_, i) => `c${i}`) : items.map((it) => it.name);
    const list = items.map((it, i) => (isReturn ? `${rendered[i]} AS ${keys[i]}` : `${rendered[i]} AS ${ident(it.name)}`));
    let out = `${kw} ${p.distinct ? 'DISTINCT ' : ''}${list.join(', ')}`;

    if (p.order.length) {
      const byAlias = new Map(items.map((it, i) => [it.name, isReturn ? keys[i]! : ident(it.name)]));
      const order = p.order.map((o) => {
        // Refer to projected columns by their aliases, as openCypher allows.
        const aliased = o.expr.k === 'var' && byAlias.has(o.expr.name) ? byAlias.get(o.expr.name)! : null;
        const sameAsItem = rendered.indexOf(this.expr(o.expr));
        const text = aliased ?? (sameAsItem >= 0 ? (isReturn ? keys[sameAsItem]! : ident(items[sameAsItem]!.name)) : this.expr(o.expr));
        return `${text}${o.desc ? ' DESC' : ''}`;
      });
      out += ` ORDER BY ${order.join(', ')}`;
    }
    if (p.skip) out += ` SKIP ${this.expr(p.skip)}`;
    if (p.limit) out += ` LIMIT ${this.expr(p.limit)}`;

    const next = new Map<string, Kind>();
    items.forEach((it) => {
      // A variable-length relationship list carried through WITH is a plain list afterwards.
      const k = it.expr.k === 'var' ? (this.scope.get(it.expr.name) ?? 'scalar') : 'scalar';
      next.set(it.name, k === 'rels' ? 'scalar' : k);
    });
    if (!isReturn) {
      // After WITH the aliases are the variables in scope.
      for (const it of items) this.names.set(it.name, ident(it.name));
      this.scope = next;
      if (p.where) out += ` WHERE ${this.expr(p.where)}`;
    } else {
      this.returnKeys = keys;
    }
    return out;
  }

  // ---- names --------------------------------------------------------------

  private declare(name: string, kind: Kind, anonymous = false): string {
    if (!this.scope.has(name)) this.scope.set(name, kind);
    if (!this.names.has(name)) this.names.set(name, anonymous ? `_a${this.anon++}` : ident(name));
    return this.names.get(name)!;
  }

  private ref(name: string): string {
    return this.names.get(name) ?? ident(name);
  }

  // ---- expressions --------------------------------------------------------

  private property(objText: string, kind: Kind | undefined, key: string): string {
    if (kind === 'node') {
      if (NODE_BUILTIN.has(key)) return `${objText}.${key}`;
      return this.typedColumn(objText, this.ctx.types.node.get(key), key);
    }
    if (kind === 'relationship') {
      if (REL_BUILTIN.has(key)) return `${objText}.${key}`;
      return this.typedColumn(objText, this.ctx.types.rel.get(key), key);
    }
    return `${objText}.${ident(key)}`;
  }

  private typedColumn(objText: string, kinds: Set<ColType> | undefined, key: string): string {
    if (!kinds || kinds.size === 0) return 'NULL';
    const t = KIND_ORDER.find((k) => kinds.has(k))!;
    if (kinds.size > 1) this.notices.add(`Property '${key}' has mixed types in the vault; the Ladybug backend compares it as ${t === 'n' ? 'a number' : t === 's' ? 'text' : t === 'b' ? 'a boolean' : 'a list'}.`);
    return `${objText}.${ident(propColumn(key, t))}`;
  }

  /** Whether an expression is list-shaped, to pick list functions over string ones. */
  private isList(e: Expr): boolean {
    switch (e.k) {
      case 'list':
        return true;
      case 'agg':
        return e.name === 'collect';
      case 'call':
        return ['nodes', 'relationships', 'split', 'labels', 'keys', 'reverse'].includes(e.name) && (e.name !== 'reverse' || this.isList(e.args[0]!));
      case 'var':
        return this.scope.get(e.name) === 'rels';
      case 'prop': {
        const kind = this.kindOf(e.obj);
        const types = kind === 'node' ? this.ctx.types.node.get(e.key) : kind === 'relationship' ? this.ctx.types.rel.get(e.key) : undefined;
        return !!types && (types.has('ls') || types.has('ln'));
      }
      default:
        return false;
    }
  }

  private kindOf(e: Expr): Kind | undefined {
    return e.k === 'var' ? this.scope.get(e.name) : undefined;
  }

  expr(e: Expr): string {
    switch (e.k) {
      case 'lit':
        return lit(e.v);
      case 'param':
        return `$${e.name}`;
      case 'var':
        return this.scope.get(e.name) === 'rels' ? `rels(${this.ref(e.name)})` : this.ref(e.name);
      case 'prop':
        return this.property(this.expr(e.obj), this.kindOf(e.obj), e.key);
      case 'index':
        return `list_extract(${this.expr(e.obj)}, (${this.expr(e.idx)}) + 1)`;
      case 'labels':
        return `(${e.labels.map((l) => `list_contains(${this.expr(e.obj)}.labels, ${str(l)})`).join(' AND ')})`;
      case 'list':
        return `[${e.items.map((i) => this.expr(i)).join(', ')}]`;
      case 'map':
        return `{${e.entries.map(([k, v]) => `${ident(k)}: ${this.expr(v)}`).join(', ')}}`;
      case 'call':
        return this.call(e.name, e.args);
      case 'agg': {
        if (e.arg === null) return 'count(*)';
        const agg = `${e.name}(${e.distinct ? 'DISTINCT ' : ''}${this.expr(e.arg)})`;
        // openCypher: sum over no rows is 0 and collect is an empty list; Ladybug gives NULL.
        if (e.name === 'sum') return `coalesce(${agg}, 0)`;
        if (e.name === 'collect') return `coalesce(${agg}, [])`;
        return agg;
      }
      case 'not':
        return `(NOT ${this.expr(e.e)})`;
      case 'neg':
        return `(-${this.expr(e.e)})`;
      case 'isnull':
        return `(${this.expr(e.e)} IS ${e.not ? 'NOT ' : ''}NULL)`;
      case 'bin': {
        const l = this.expr(e.l);
        const r = this.expr(e.r);
        switch (e.op) {
          case '^':
            return `pow(${l}, ${r})`;
          case 'starts':
            return `(${l} STARTS WITH ${r})`;
          case 'ends':
            return `(${l} ENDS WITH ${r})`;
          case 'contains':
            return `(${l} CONTAINS ${r})`;
          case 'in':
            return `(${l} IN ${r})`;
          default:
            return `(${l} ${e.op.toUpperCase()} ${r})`;
        }
      }
    }
  }

  private call(name: string, args: Expr[]): string {
    const a = args.map((x) => this.expr(x));
    const objKind = args[0] ? this.kindOf(args[0]) : undefined;
    switch (name) {
      case 'id':
        return `${a[0]}.id`;
      case 'type':
        return `label(${a[0]})`;
      case 'labels':
        return `${a[0]}.labels`;
      case 'tolower':
        return `lower(${a[0]})`;
      case 'toupper':
        return `upper(${a[0]})`;
      case 'tostring':
        return `CAST(${a[0]} AS STRING)`;
      case 'tointeger':
        return `CAST(${a[0]} AS INT64)`;
      case 'tofloat':
        return `CAST(${a[0]} AS DOUBLE)`;
      case 'toboolean':
        return `CAST(${a[0]} AS BOOLEAN)`;
      case 'substring':
        // openCypher is 0-based; Ladybug is 1-based.
        return a.length > 2 ? `substring(${a[0]}, (${a[1]}) + 1, ${a[2]})` : `substring(${a[0]}, (${a[1]}) + 1, size(${a[0]}))`;
      case 'split':
        return `string_split(${a[0]}, ${a[1]})`;
      case 'round':
        return `round(${a[0]}, 0)`;
      case 'reverse':
        return this.isList(args[0]!) ? `list_reverse(${a[0]})` : `reverse(${a[0]})`;
      case 'head':
        return `list_extract(${a[0]}, 1)`;
      case 'last':
        return `list_extract(${a[0]}, size(${a[0]}))`;
      case 'relationships':
        return objKind === 'rels' ? this.expr(args[0]!) : `rels(${a[0]})`;
      case 'length':
        return objKind === 'path' ? `length(${a[0]})` : `size(${a[0]})`;
      case 'startnode':
      case 'endnode':
      case 'keys':
      case 'properties':
        throw unsupported(`${name}()`);
      default:
        return `${name}(${a.join(', ')})`;
    }
  }
}

function lit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'string') return str(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`;
  return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${ident(k)}: ${lit(x)}`).join(', ')}}`;
}
