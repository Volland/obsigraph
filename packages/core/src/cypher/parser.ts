import type { AggName, BinOp, Clause, Direction, Expr, NodePattern, Pattern, Projection, Query, RelPattern, ReturnItem, SortItem } from './ast.js';
import { CypherError, lex, type Token } from './lexer.js';

const WRITE_CLAUSES = new Set(['CREATE', 'MERGE', 'SET', 'DELETE', 'DETACH', 'REMOVE', 'FOREACH', 'DROP']);

const UNSUPPORTED_CLAUSES: Record<string, string> = {
  UNWIND: 'UNWIND',
  UNION: 'UNION',
  CALL: 'CALL',
  LOAD: 'LOAD CSV',
  USE: 'USE',
};

const AGGREGATES = new Set<AggName>(['count', 'sum', 'avg', 'min', 'max', 'collect']);
const UNSUPPORTED_AGGREGATES = new Set(['stdev', 'stdevp', 'percentilecont', 'percentiledisc']);

export const FUNCTIONS = new Set([
  'id', 'type', 'labels', 'keys', 'properties', 'startnode', 'endnode',
  'tolower', 'toupper', 'trim', 'ltrim', 'rtrim', 'replace', 'substring', 'split', 'left', 'right',
  'size', 'coalesce', 'tostring', 'tointeger', 'tofloat', 'toboolean',
  'abs', 'round', 'floor', 'ceil', 'sign', 'head', 'last', 'reverse',
  'length', 'nodes', 'relationships',
]);

const COMPARISON: Record<string, BinOp> = { '=': '=', '<>': '<>', '<': '<', '>': '>', '<=': '<=', '>=': '>=' };

const unsupported = (what: string, t: Token) =>
  new CypherError('unsupported', `${what} is not supported by the built-in engine in this version`, t.line, t.column);

/** Parse a query in the supported read-only openCypher subset. */
// @lat: [[query-engine#Supported subset]]
export function parseQuery(src: string): Query {
  return new Parser(src).parse();
}

/** True when the expression contains an aggregate anywhere. */
export function containsAgg(e: Expr): boolean {
  switch (e.k) {
    case 'agg':
      return true;
    case 'prop':
    case 'labels':
      return containsAgg(e.obj);
    case 'index':
      return containsAgg(e.obj) || containsAgg(e.idx);
    case 'list':
      return e.items.some(containsAgg);
    case 'map':
      return e.entries.some(([, v]) => containsAgg(v));
    case 'call':
      return e.args.some(containsAgg);
    case 'not':
    case 'neg':
    case 'isnull':
      return containsAgg(e.e);
    case 'bin':
      return containsAgg(e.l) || containsAgg(e.r);
    default:
      return false;
  }
}

class Parser {
  private readonly toks: Token[];
  private i = 0;
  private anon = 0;

  constructor(private readonly src: string) {
    this.toks = lex(src);
  }

  // ---- token helpers ------------------------------------------------------

  private peek(o = 0): Token {
    return this.toks[Math.min(this.i + o, this.toks.length - 1)]!;
  }
  private next(): Token {
    const t = this.peek();
    if (t.kind !== 'eof') this.i++;
    return t;
  }
  private prevEnd(): number {
    return this.toks[this.i - 1]?.end ?? 0;
  }
  private isKw(word: string, o = 0): boolean {
    const t = this.peek(o);
    return t.kind === 'name' && t.value.toUpperCase() === word;
  }
  private isP(p: string, o = 0): boolean {
    const t = this.peek(o);
    return t.kind === 'punct' && t.value === p;
  }
  private describe(t: Token): string {
    return t.kind === 'eof' ? 'end of query' : `'${t.kind === 'string' ? JSON.stringify(t.value) : t.value}'`;
  }
  private err(msg: string, t = this.peek()): CypherError {
    return new CypherError('syntax', msg, t.line, t.column);
  }
  private expectP(p: string): Token {
    if (!this.isP(p)) throw this.err(`Expected '${p}' but found ${this.describe(this.peek())}`);
    return this.next();
  }
  private expectKw(word: string): Token {
    if (!this.isKw(word)) throw this.err(`Expected ${word} but found ${this.describe(this.peek())}`);
    return this.next();
  }
  private symbolicName(what: string): string {
    const t = this.peek();
    if (t.kind !== 'name' && t.kind !== 'escaped') throw this.err(`Expected ${what} but found ${this.describe(t)}`);
    this.next();
    return t.value;
  }
  private integer(what: string): number {
    const t = this.peek();
    if (t.kind !== 'number' || !/^\d+$/.test(t.value)) throw this.err(`Expected ${what} but found ${this.describe(t)}`);
    this.next();
    return Number(t.value);
  }

  /** Reject clauses outside the subset with the most specific error. */
  private checkClause(): void {
    const t = this.peek();
    if (t.kind !== 'name') return;
    const up = t.value.toUpperCase();
    if (WRITE_CLAUSES.has(up)) {
      throw new CypherError('readonly', `Queries are read-only: ${up} is not allowed`, t.line, t.column);
    }
    const what = UNSUPPORTED_CLAUSES[up];
    if (what) throw unsupported(what, t);
  }

  // ---- clauses ------------------------------------------------------------

  parse(): Query {
    const clauses: Clause[] = [];
    for (;;) {
      this.checkClause();
      if (this.isKw('OPTIONAL')) {
        this.next();
        this.expectKw('MATCH');
        clauses.push(this.parseMatch(true));
      } else if (this.isKw('MATCH')) {
        this.next();
        clauses.push(this.parseMatch(false));
      } else if (this.isKw('WITH')) {
        this.next();
        clauses.push({ k: 'with', proj: this.parseProjection(true) });
      } else if (this.isKw('RETURN')) {
        this.next();
        clauses.push({ k: 'return', proj: this.parseProjection(false) });
        break;
      } else {
        throw this.err(`Expected MATCH, OPTIONAL MATCH, WITH or RETURN but found ${this.describe(this.peek())}`);
      }
    }
    if (this.isP(';')) this.next();
    if (this.peek().kind !== 'eof') {
      this.checkClause();
      throw this.err(`Unexpected ${this.describe(this.peek())} after RETURN`);
    }
    return { clauses };
  }

  private parseMatch(optional: boolean): Clause {
    const patterns: Pattern[] = [];
    do {
      patterns.push(this.parsePattern());
    } while (this.isP(',') && this.next());
    let where: Expr | null = null;
    if (this.isKw('WHERE')) {
      const t = this.next();
      where = this.parseExpr();
      if (containsAgg(where)) throw this.err('Aggregations are not allowed in WHERE; aggregate in WITH first', t);
    }
    return { k: 'match', optional, patterns, where };
  }

  private parseProjection(isWith: boolean): Projection {
    const distinct = this.isKw('DISTINCT');
    if (distinct) this.next();
    let star = false;
    const items: ReturnItem[] = [];
    if (this.isP('*')) {
      this.next();
      star = true;
    }
    if (!star || this.isP(',')) {
      if (star) this.next();
      do {
        items.push(this.parseItem(isWith));
      } while (this.isP(',') && this.next());
    }

    const order: SortItem[] = [];
    if (this.isKw('ORDER')) {
      this.next();
      this.expectKw('BY');
      do {
        const expr = this.parseExpr();
        let desc = false;
        if (this.isKw('DESC') || this.isKw('DESCENDING')) {
          this.next();
          desc = true;
        } else if (this.isKw('ASC') || this.isKw('ASCENDING')) {
          this.next();
        }
        order.push({ expr, desc });
      } while (this.isP(',') && this.next());
    }
    let skip: Expr | null = null;
    if (this.isKw('SKIP')) {
      this.next();
      skip = this.parseExpr();
    }
    let limit: Expr | null = null;
    if (this.isKw('LIMIT')) {
      this.next();
      limit = this.parseExpr();
    }
    let where: Expr | null = null;
    if (isWith && this.isKw('WHERE')) {
      const t = this.next();
      where = this.parseExpr();
      if (containsAgg(where)) throw this.err('Aggregations are not allowed in WHERE; alias them in WITH first', t);
    }
    return { distinct, star, items, order, skip, limit, where };
  }

  private parseItem(isWith: boolean): ReturnItem {
    const start = this.peek();
    const expr = this.parseExpr();
    let name = this.src.slice(start.start, this.prevEnd()).trim();
    if (this.isKw('AS')) {
      this.next();
      name = this.symbolicName('alias');
    } else if (isWith && expr.k !== 'var') {
      throw this.err(`Expression '${name}' in WITH must be aliased with AS`, start);
    }
    return { expr, name };
  }

  // ---- patterns -----------------------------------------------------------

  private parsePattern(): Pattern {
    let pathVar: string | null = null;
    if ((this.peek().kind === 'name' || this.peek().kind === 'escaped') && this.isP('=', 1)) {
      pathVar = this.next().value;
      this.next();
    }
    if (this.isKw('SHORTESTPATH') || this.isKw('ALLSHORTESTPATHS')) throw unsupported(this.peek().value, this.peek());
    const nodes = [this.parseNode()];
    const rels: RelPattern[] = [];
    while (this.isP('-') || this.isP('<-')) {
      rels.push(this.parseRel());
      nodes.push(this.parseNode());
    }
    return { pathVar, nodes, rels };
  }

  private variable(): { var: string; anonymous: boolean } {
    const t = this.peek();
    if (t.kind === 'name' || t.kind === 'escaped') {
      this.next();
      return { var: t.value, anonymous: false };
    }
    return { var: ` anon${this.anon++}`, anonymous: true };
  }

  private parseNode(): NodePattern {
    this.expectP('(');
    const v = this.variable();
    const labels: string[] = [];
    while (this.isP(':')) {
      this.next();
      labels.push(this.symbolicName('label'));
    }
    const props = this.isP('{') ? this.parseMapEntries() : [];
    this.expectP(')');
    return { ...v, labels, props };
  }

  private parseRel(): RelPattern {
    const left = this.isP('<-');
    this.next();
    let v = { var: ` anon${this.anon++}`, anonymous: true };
    const types: string[] = [];
    let props: [string, Expr][] = [];
    let length: RelPattern['length'] = null;
    if (this.isP('[')) {
      this.next();
      v = this.variable();
      if (this.isP(':')) {
        this.next();
        types.push(this.symbolicName('relationship type'));
        while (this.isP('|')) {
          this.next();
          if (this.isP(':')) this.next();
          types.push(this.symbolicName('relationship type'));
        }
      }
      if (this.isP('*')) length = this.parseLength();
      if (this.isP('{')) props = this.parseMapEntries();
      this.expectP(']');
    }
    let right = false;
    if (this.isP('->')) right = true;
    else if (!this.isP('-')) throw this.err(`Expected '-' or '->' but found ${this.describe(this.peek())}`);
    const closing = this.next();
    if (left && right) throw this.err('A relationship cannot point in both directions', closing);
    const dir: Direction = right ? 'out' : left ? 'in' : 'both';
    return { ...v, types, props, dir, length };
  }

  /** `*`, `*n`, `*n..m`, `*..m`, `*n..` */
  private parseLength(): { min: number; max: number | null } {
    const star = this.next();
    let min = 1;
    let max: number | null = null;
    if (this.peek().kind === 'number') {
      min = this.integer('a path length');
      if (this.isP('..')) {
        this.next();
        max = this.peek().kind === 'number' ? this.integer('a path length') : null;
      } else {
        max = min;
      }
    } else if (this.isP('..')) {
      this.next();
      max = this.integer('a path length');
    }
    if (max !== null && max < min) throw this.err(`Path length range *${min}..${max} is empty`, star);
    return { min, max };
  }

  private parseMapEntries(): [string, Expr][] {
    this.expectP('{');
    const entries: [string, Expr][] = [];
    if (!this.isP('}')) {
      do {
        const key = this.symbolicName('property name');
        this.expectP(':');
        entries.push([key, this.parseExpr()]);
      } while (this.isP(',') && this.next());
    }
    this.expectP('}');
    return entries;
  }

  // ---- expressions --------------------------------------------------------

  parseExpr(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let l = this.parseXor();
    while (this.isKw('OR')) {
      this.next();
      l = { k: 'bin', op: 'or', l, r: this.parseXor() };
    }
    return l;
  }
  private parseXor(): Expr {
    let l = this.parseAnd();
    while (this.isKw('XOR')) {
      this.next();
      l = { k: 'bin', op: 'xor', l, r: this.parseAnd() };
    }
    return l;
  }
  private parseAnd(): Expr {
    let l = this.parseNot();
    while (this.isKw('AND')) {
      this.next();
      l = { k: 'bin', op: 'and', l, r: this.parseNot() };
    }
    return l;
  }
  private parseNot(): Expr {
    if (this.isKw('NOT')) {
      this.next();
      return { k: 'not', e: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let l = this.parseAdditive();
    for (;;) {
      const t = this.peek();
      if (t.kind === 'punct' && COMPARISON[t.value]) {
        this.next();
        l = { k: 'bin', op: COMPARISON[t.value]!, l, r: this.parseAdditive() };
      } else if (this.isP('=~')) {
        throw unsupported('Regular expression match (=~)', t);
      } else if (this.isKw('IN')) {
        this.next();
        l = { k: 'bin', op: 'in', l, r: this.parseAdditive() };
      } else if (this.isKw('STARTS') || this.isKw('ENDS')) {
        const op = this.isKw('STARTS') ? 'starts' : 'ends';
        this.next();
        this.expectKw('WITH');
        l = { k: 'bin', op, l, r: this.parseAdditive() };
      } else if (this.isKw('CONTAINS')) {
        this.next();
        l = { k: 'bin', op: 'contains', l, r: this.parseAdditive() };
      } else if (this.isKw('IS')) {
        this.next();
        const not = this.isKw('NOT');
        if (not) this.next();
        this.expectKw('NULL');
        l = { k: 'isnull', e: l, not };
      } else {
        return l;
      }
    }
  }

  private parseAdditive(): Expr {
    let l = this.parseMultiplicative();
    while (this.isP('+') || this.isP('-')) {
      const op = this.next().value as BinOp;
      l = { k: 'bin', op, l, r: this.parseMultiplicative() };
    }
    return l;
  }
  private parseMultiplicative(): Expr {
    let l = this.parsePower();
    while (this.isP('*') || this.isP('/') || this.isP('%')) {
      const op = this.next().value as BinOp;
      l = { k: 'bin', op, l, r: this.parsePower() };
    }
    return l;
  }
  private parsePower(): Expr {
    let l = this.parseUnary();
    while (this.isP('^')) {
      this.next();
      l = { k: 'bin', op: '^', l, r: this.parseUnary() };
    }
    return l;
  }
  private parseUnary(): Expr {
    if (this.isP('-')) {
      this.next();
      return { k: 'neg', e: this.parseUnary() };
    }
    if (this.isP('+')) {
      this.next();
      return this.parseUnary();
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let e = this.parseAtom();
    for (;;) {
      if (this.isP('.')) {
        this.next();
        e = { k: 'prop', obj: e, key: this.symbolicName('property name') };
      } else if (this.isP('[')) {
        this.next();
        if (this.isP('..')) throw unsupported('List slicing', this.peek());
        const idx = this.parseExpr();
        if (this.isP('..')) throw unsupported('List slicing', this.peek());
        this.expectP(']');
        e = { k: 'index', obj: e, idx };
      } else if (this.isP(':')) {
        const labels: string[] = [];
        while (this.isP(':')) {
          this.next();
          labels.push(this.symbolicName('label'));
        }
        e = { k: 'labels', obj: e, labels };
      } else {
        return e;
      }
    }
  }

  private parseAtom(): Expr {
    const t = this.peek();
    switch (t.kind) {
      case 'number':
        this.next();
        return { k: 'lit', v: Number(t.value) };
      case 'string':
        this.next();
        return { k: 'lit', v: t.value };
      case 'param':
        this.next();
        return { k: 'param', name: t.value };
      case 'escaped':
        this.next();
        return { k: 'var', name: t.value, line: t.line, column: t.column };
      case 'punct':
        if (t.value === '(') {
          this.next();
          const e = this.parseExpr();
          this.expectP(')');
          return e;
        }
        if (t.value === '[') {
          this.next();
          const items: Expr[] = [];
          if (!this.isP(']')) {
            do {
              items.push(this.parseExpr());
            } while (this.isP(',') && this.next());
          }
          this.expectP(']');
          return { k: 'list', items };
        }
        if (t.value === '{') return { k: 'map', entries: this.parseMapEntries() };
        break;
      case 'name': {
        const up = t.value.toUpperCase();
        if (up === 'TRUE' || up === 'FALSE') {
          this.next();
          return { k: 'lit', v: up === 'TRUE' };
        }
        if (up === 'NULL') {
          this.next();
          return { k: 'lit', v: null };
        }
        if (up === 'CASE') throw unsupported('CASE expressions', t);
        if (up === 'EXISTS' && this.isP('{', 1)) throw unsupported('EXISTS subqueries', t);
        if (this.isP('(', 1)) return this.parseCall();
        this.next();
        return { k: 'var', name: t.value, line: t.line, column: t.column };
      }
      default:
        break;
    }
    throw this.err(`Unexpected ${this.describe(t)} in expression`);
  }

  private parseCall(): Expr {
    const t = this.next();
    const name = t.value.toLowerCase();
    if (AGGREGATES.has(name as AggName)) return this.parseAggregate(name as AggName, t);
    if (UNSUPPORTED_AGGREGATES.has(name)) throw unsupported(`Aggregation function ${t.value}()`, t);
    if (!FUNCTIONS.has(name)) throw unsupported(`Function ${t.value}()`, t);
    this.expectP('(');
    const args: Expr[] = [];
    if (!this.isP(')')) {
      do {
        args.push(this.parseExpr());
      } while (this.isP(',') && this.next());
    }
    this.expectP(')');
    return { k: 'call', name, args };
  }

  private parseAggregate(name: AggName, t: Token): Expr {
    this.expectP('(');
    if (name === 'count' && this.isP('*')) {
      this.next();
      this.expectP(')');
      return { k: 'agg', name, arg: null, distinct: false, line: t.line, column: t.column };
    }
    const distinct = this.isKw('DISTINCT');
    if (distinct) this.next();
    const arg = this.parseExpr();
    if (containsAgg(arg)) throw this.err(`Aggregations cannot be nested inside ${t.value}()`, t);
    this.expectP(')');
    return { k: 'agg', name, arg, distinct, line: t.line, column: t.column };
  }
}
