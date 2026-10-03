import type { JsonQueryResult, JsonValue } from '@obsigraph/core';

export interface CorpusEntry {
  id: string;
  query: string;
  /** Documented intentional difference this query exercises. */
  difference?: string;
  /** Recorded built-in result (columns and rows, or an error kind). */
  expected?: EngineOutcome;
}

export interface Difference {
  id: string;
  construct: string;
  builtin: string;
  ladybug: string;
}

/** What one engine produced: a result or an error kind. */
export type EngineOutcome = { ok: true; result: JsonQueryResult } | { ok: false; error: string };

export type Outcome =
  | { kind: 'match' }
  | { kind: 'expected-difference'; difference: string }
  | { kind: 'divergence'; reason: string; builtin: EngineOutcome; ladybug: EngineOutcome }
  | { kind: 'skipped'; reason: string };

/** True when the query orders its final result, so row order matters. */
export function isOrdered(query: string): boolean {
  const ret = query.toUpperCase().lastIndexOf('RETURN');
  return ret >= 0 && /\bORDER\s+BY\b/.test(query.toUpperCase().slice(ret));
}

const key = (v: JsonValue) => JSON.stringify(v);

/**
 * Compare two outcomes: errors must have the same kind; results must have the
 * same column names and kinds, the same rows as a multiset, and the same row
 * order only when the query has ORDER BY.
 */
// @lat: [[query-engine#Two backends]]
export function compare(query: string, a: EngineOutcome, b: EngineOutcome): string | null {
  if (!a.ok || !b.ok) {
    if (!a.ok && !b.ok) return a.error === b.error ? null : `error kinds differ: ${a.error} vs ${b.error}`;
    return `only one engine failed: ${a.ok ? 'ladybug' : 'builtin'} (${!a.ok ? a.error : (b as { error: string }).error})`;
  }
  const ca = a.result.columns;
  const cb = b.result.columns;
  if (key(ca.map((c) => c.name) as never) !== key(cb.map((c) => c.name) as never)) return 'column names differ';
  if (key(ca.map((c) => c.kind) as never) !== key(cb.map((c) => c.kind) as never)) return 'column kinds differ';
  const ra = a.result.rows.map((r) => key(r as never));
  const rb = b.result.rows.map((r) => key(r as never));
  if (ra.length !== rb.length) return `row counts differ: ${ra.length} vs ${rb.length}`;
  if (isOrdered(query)) return ra.every((r, i) => r === rb[i]) ? null : 'row order differs under ORDER BY';
  const sa = [...ra].sort();
  const sb = [...rb].sort();
  return sa.every((r, i) => r === sb[i]) ? null : 'rows differ';
}

/** Classify one corpus entry given both engines' outcomes (ladybug null = unavailable). */
export function classify(entry: CorpusEntry, builtin: EngineOutcome, ladybug: EngineOutcome | null, skipReason = 'Ladybug unavailable'): Outcome {
  if (!ladybug) return { kind: 'skipped', reason: skipReason };
  const reason = compare(entry.query, builtin, ladybug);
  if (reason === null) return { kind: 'match' };
  if (entry.difference) return { kind: 'expected-difference', difference: entry.difference };
  return { kind: 'divergence', reason, builtin, ladybug };
}

export interface RegistryProblem {
  difference: string;
  problem: 'no-query' | 'stale' | 'unknown';
}

/**
 * Keep the differences list and the corpus in lock-step: every documented
 * difference needs a query, every cited difference must exist, and an entry
 * whose queries all match on both engines is stale.
 */
export function checkRegistry(differences: Difference[], corpus: CorpusEntry[], outcomes: Map<string, Outcome>): RegistryProblem[] {
  const problems: RegistryProblem[] = [];
  const ids = new Set(differences.map((d) => d.id));
  for (const e of corpus) if (e.difference && !ids.has(e.difference)) problems.push({ difference: e.difference, problem: 'unknown' });
  for (const d of differences) {
    const queries = corpus.filter((e) => e.difference === d.id);
    if (queries.length === 0) {
      problems.push({ difference: d.id, problem: 'no-query' });
      continue;
    }
    const results = queries.map((q) => outcomes.get(q.id)).filter((o): o is Outcome => !!o && o.kind !== 'skipped');
    if (results.length > 0 && results.every((o) => o.kind === 'match')) problems.push({ difference: d.id, problem: 'stale' });
  }
  return problems;
}

export function summarize(outcomes: Iterable<Outcome>): Record<Outcome['kind'], number> {
  const counts = { match: 0, 'expected-difference': 0, divergence: 0, skipped: 0 };
  for (const o of outcomes) counts[o.kind]++;
  return counts;
}
