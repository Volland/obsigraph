import type { Value } from './values.js';

export type BinOp =
  | 'or' | 'xor' | 'and'
  | '=' | '<>' | '<' | '>' | '<=' | '>='
  | '+' | '-' | '*' | '/' | '%' | '^'
  | 'in' | 'starts' | 'ends' | 'contains';

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
}

export interface Pattern {
  nodes: NodePattern[];
  rels: RelPattern[];
}

export interface MatchClause {
  patterns: Pattern[];
  where: Expr | null;
}

export interface ReturnItem {
  expr: Expr;
  name: string;
}

export interface SortItem {
  expr: Expr;
  desc: boolean;
}

export interface Query {
  matches: MatchClause[];
  distinct: boolean;
  star: boolean;
  items: ReturnItem[];
  order: SortItem[];
  skip: Expr | null;
  limit: Expr | null;
}
