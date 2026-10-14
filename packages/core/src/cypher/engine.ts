import type { Graph } from '../graph/graph.js';
import { execute, type ExecOptions, type QueryResult } from './exec.js';
import { parseQuery } from './parser.js';

/** One query interface; the Ladybug backend will implement it too. */
export interface QueryEngine {
  run(query: string, params?: Record<string, unknown>): QueryResult;
}

/** The in-plugin engine over the live in-memory graph. */
// @tg: implements:: [[query-engine#Two backends]] {since: "2026-10-03"}
// @lat: [[query-engine#Two backends]]
export class BuiltinEngine implements QueryEngine {
  constructor(
    private readonly graph: Graph,
    private readonly options: () => ExecOptions = () => ({}),
  ) {}

  run(query: string, params: Record<string, unknown> = {}): QueryResult {
    return execute(this.graph, parseQuery(query), params, this.options());
  }
}
