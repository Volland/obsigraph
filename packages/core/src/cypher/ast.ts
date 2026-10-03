import type { Value } from './values.js';

export type BinOp =
  | 'or' | 'xor' | 'and'
  | '=' | '<>' | '<' | '>' | '<=' | '>='
  | '+' | '-' | '*' | '/' | '%' | '^'
  | 'in' | 'starts' | 'ends' | 'contains';

export type AggName = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'collect';

export type Expr =
  | { k: 'lit'; v: Value }
  | { k: 'param'; name: string }
  | { k: 'var'; name: string; line: number; column: number }
  | { k: 'prop'; obj: Expr; key: string }
  | { k: 'index'; obj: Expr; idx: Expr }
  | { k: 'labels'; obj: Expr; labels: string[] }
  | { k: 'list'; items: Expr[] }
  | { k: 'map'; entries: [string, Expr][] }
  | { k: 'call'; name: string; args: Expr[] }
  /** Aggregate; `arg` is null for `count(*)`. */
  | { k: 'agg'; name: AggName; arg: Expr | null; distinct: boolean; line: number; column: number }
  | { k: 'not'; e: Expr }
  | { k: 'neg'; e: Expr }
  | { k: 'isnull'; e: Expr; not: boolean }
  | { k: 'bin'; op: BinOp; l: Expr; r: Expr };

export interface NodePattern {
  var: string;
  anonymous: boolean;
  labels: string[];
  props: [string, Expr][];
}

export type Direction = 'out' | 'in' | 'both';

export interface RelPattern {
  var: string;
  anonymous: boolean;
  types: string[];
  props: [string, Expr][];
  dir: Direction;
  /** Variable-length bounds; `max` null means unbounded (capped at run time). */
  length: { min: number; max: number | null } | null;
}

export interface Pattern {
  /** `p` in `p = (a)-->(b)`. */
  pathVar: string | null;
  nodes: NodePattern[];
  rels: RelPattern[];
}

export interface ReturnItem {
  expr: Expr;
  name: string;
}

export interface SortItem {
  expr: Expr;
  desc: boolean;
}

/** Shared body of WITH and RETURN. */
export interface Projection {
  distinct: boolean;
  star: boolean;
  items: ReturnItem[];
  order: SortItem[];
  skip: Expr | null;
  limit: Expr | null;
  /** WITH only: filter applied after the projection. */
  where: Expr | null;
}

export type Clause =
  | { k: 'match'; optional: boolean; patterns: Pattern[]; where: Expr | null }
  | { k: 'with'; proj: Projection }
  | { k: 'return'; proj: Projection };

/** A query is a pipeline of clauses ending in RETURN. */
export interface Query {
  clauses: Clause[];
}
