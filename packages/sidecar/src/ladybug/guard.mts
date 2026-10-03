import { CypherError, lex, type Token } from '@obsigraph/core';

/** Statements and clauses that write, change schema or escape the query sandbox. */
const FORBIDDEN = new Set([
  'CREATE', 'MERGE', 'SET', 'DELETE', 'DETACH', 'REMOVE', 'DROP', 'ALTER', 'COPY', 'INSTALL', 'LOAD',
  'ATTACH', 'EXPORT', 'IMPORT', 'CHECKPOINT', 'BEGIN', 'COMMIT', 'ROLLBACK', 'USE', 'CALL', 'FOREACH', 'TRUNCATE',
]);
const READ_START = new Set(['MATCH', 'OPTIONAL', 'WITH', 'RETURN', 'UNWIND']);

const fail = (msg: string, t: Token, kind: 'readonly' | 'syntax' = 'readonly') => new CypherError(kind, msg, t.line, t.column);

/**
 * Reject anything but a single read query before it reaches LadybugDB.
 * Keywords inside strings, comments, backticks, property names (`n.set`)
 * and labels (`:Create`) are ignored because the lexer classifies them.
 * The database is also opened read-only, so this is the first of two walls.
 */
// @lat: [[ladybug-mirror#One-way mirror]]
export function assertReadOnly(query: string): void {
  let toks: Token[];
  try {
    toks = lex(query);
  } catch (e) {
    if (e instanceof CypherError) throw e;
    throw e;
  }
  const first = toks.find((t) => t.kind !== 'eof');
  if (!first) throw new CypherError('syntax', 'Empty query', 1, 1);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    if (t.kind === 'punct' && t.value === ';') {
      if (toks.slice(i + 1).some((x) => x.kind !== 'eof')) throw fail('Only a single statement is allowed', t);
      continue;
    }
    if (t.kind !== 'name') continue;
    const prev = toks[i - 1];
    if (prev && prev.kind === 'punct' && (prev.value === '.' || prev.value === ':' || prev.value === '|')) continue;
    const up = t.value.toUpperCase();
    if (FORBIDDEN.has(up)) {
      throw fail(up === 'CALL' ? 'Queries are read-only: CALL is not allowed' : `Queries are read-only: ${up} is not allowed`, t);
    }
  }
  if (first.kind !== 'name' || !READ_START.has(first.value.toUpperCase())) {
    throw fail(`Not a read query: expected MATCH, OPTIONAL MATCH, WITH, UNWIND or RETURN but found '${first.value}'`, first);
  }
}
