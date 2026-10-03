import { writeFileSync } from 'node:fs';
import { BuiltinEngine, CypherError, FUNCTIONS } from '@obsigraph/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkRegistry, compare, summarize, type EngineOutcome } from '../conformance/compare.js';
import { CORPUS_FILE, loadCorpus, loadDifferences, runCorpus, type RunReport } from '../conformance/runner.js';
import { startSidecar } from '../src/main.js';
import { FIXTURE } from '../conformance/runner.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let report: RunReport;
beforeAll(async () => {
  report = await runCorpus();
  if (process.env.OBSIGRAPH_RECORD === '1') {
    const corpus = loadCorpus().map((e) => ({ ...e, expected: report.builtin.get(e.id) }));
    writeFileSync(CORPUS_FILE, `${JSON.stringify(corpus, null, 2)}\n`);
  }
}, 120000);

describe('engine conformance suite', () => {
  // @lat: [[tests/engine-conformance#Both engines run the corpus]]
  it('runs every corpus query on both engines with no unclassified divergence', () => {
    const counts = summarize(report.outcomes.values());
    if (report.ladybug) expect(report.ladybug.size).toBe(report.entries.length);
    const divergences = [...report.outcomes].filter(([, o]) => o.kind === 'divergence');
    expect(divergences.map(([id, o]) => `${id}: ${JSON.stringify(o)}`)).toEqual([]);
    expect(counts.match + counts['expected-difference'] + counts.skipped).toBe(report.entries.length);
  });

  // @lat: [[tests/engine-conformance#Differences registry in lock-step]]
  it('keeps the documented differences and the corpus in lock-step', () => {
    expect(checkRegistry(loadDifferences(), report.entries, report.outcomes)).toEqual([]);
  });

  // @lat: [[tests/engine-conformance#Recorded built-in expectations]]
  it('matches the recorded built-in expectations, with or without Ladybug', async () => {
    for (const e of report.entries) {
      expect(e.expected, `${e.id} has no recorded expectation; run with OBSIGRAPH_RECORD=1`).toBeDefined();
      expect(compare(e.query, report.builtin.get(e.id)!, e.expected!), e.id).toBeNull();
    }
    const offline = await runCorpus(loadCorpus(), { ladybug: false });
    expect([...offline.outcomes.values()].every((o) => o.kind === 'skipped' && o.reason === 'Ladybug comparison disabled')).toBe(true);
    for (const e of offline.entries) expect(compare(e.query, offline.builtin.get(e.id)!, e.expected!), e.id).toBeNull();
  }, 120000);

  // @lat: [[tests/engine-conformance#Writes rejected on both]]
  it('rejects writes on both engines and leaves the fixture unchanged', async () => {
    const data = mkdtempSync(join(tmpdir(), 'obsigraph-conf-w-'));
    const sc = await startSidecar({ OBSIGRAPH_VAULT: FIXTURE, OBSIGRAPH_DATA: data, OBSIGRAPH_TOKEN: 't', OBSIGRAPH_PORT: '0' }, { log: () => {} });
    try {
      await sc.mirror?.idle();
      const before = sc.sync.graph.size;
      expect(() => new BuiltinEngine(sc.sync.graph).run('CREATE (n:Person)')).toThrow(expect.objectContaining({ kind: 'readonly' }) as CypherError);
      if (sc.mirror) {
        const res = await fetch(`http://127.0.0.1:${sc.port}/query`, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ query: 'CREATE (n:Person)', backend: 'ladybug' }) });
        expect(res.status).toBe(400);
        expect(((await res.json()) as { error: { kind: string } }).error.kind).toBe('readonly');
        expect(sc.mirror.status().nodes).toBe(before.nodes);
      }
      expect(sc.sync.graph.size).toEqual(before);
    } finally {
      await sc.stop();
      rmSync(data, { recursive: true, force: true });
    }
  });

  // @lat: [[tests/engine-conformance#Corpus covers the subset]]
  it('has a corpus query for every supported clause, function and aggregate', () => {
    const text = report.entries.map((e) => e.query.toUpperCase()).join('\n');
    const clauses = ['MATCH', 'OPTIONAL MATCH', 'WITH', 'WHERE', 'RETURN', 'DISTINCT', 'ORDER BY', 'DESC', 'SKIP', 'LIMIT', 'STARTS WITH', 'ENDS WITH', 'CONTAINS', 'IS NULL', 'IS NOT NULL', ' IN ', ' XOR ', ' NOT ', '*..', '..]', 'P = '];
    const functions = [...FUNCTIONS, 'count', 'sum', 'avg', 'min', 'max', 'collect'].map((f) => `${f.toUpperCase()}(`);
    const missing = [...clauses, ...functions].filter((c) => !text.includes(c));
    expect(missing).toEqual([]);
  });

  // @lat: [[tests/engine-conformance#Fixture coverage]]
  it('uses a fixture with multi-labels, stubs, signed, pinned and parallel edges and edge properties', async () => {
    const g = await (async () => {
      const data = mkdtempSync(join(tmpdir(), 'obsigraph-conf-f-'));
      const sc = await startSidecar({ OBSIGRAPH_VAULT: FIXTURE, OBSIGRAPH_DATA: data, OBSIGRAPH_TOKEN: 't', OBSIGRAPH_PORT: '0', OBSIGRAPH_LADYBUG: '0' }, { log: () => {} });
      const graph = sc.sync.graph;
      await sc.stop();
      rmSync(data, { recursive: true, force: true });
      return graph;
    })();
    const nodes = [...g.nodes()];
    const edges = [...g.edges()];
    expect(nodes.some((n) => n.labels.length > 1)).toBe(true);
    expect(nodes.some((n) => n.stub)).toBe(true);
    expect(edges.some((e) => e.sign === -1) && edges.some((e) => e.sign === 1)).toBe(true);
    expect(edges.some((e) => e.props.id !== undefined)).toBe(true);
    expect(edges.some((e) => Object.keys(e.props).some((k) => k !== 'id'))).toBe(true);
    const pairs = edges.map((e) => `${e.source}|${e.type}|${e.target}`);
    expect(new Set(pairs).size).toBeLessThan(pairs.length);
  });
});

const ok = (rows: unknown[][], kinds: string[] = rows[0]?.map(() => 'scalar') ?? []): EngineOutcome => ({
  ok: true,
  result: { columns: kinds.map((kind, i) => ({ name: `c${i}`, kind: kind as never })), rows: rows as never },
});

describe('conformance comparison rules', () => {
  // @lat: [[tests/engine-conformance#Unordered rows compare as sets]]
  it('treats rows as a multiset without ORDER BY', () => {
    expect(compare('MATCH (n) RETURN n.x', ok([[1], [2]]), ok([[2], [1]]))).toBeNull();
    expect(compare('MATCH (n) RETURN n.x', ok([[1], [1]]), ok([[1], [2]]))).toBe('rows differ');
  });

  // @lat: [[tests/engine-conformance#Order matters under ORDER BY]]
  it('requires the same order under ORDER BY', () => {
    expect(compare('MATCH (n) RETURN n.x ORDER BY n.x', ok([[1], [2]]), ok([[2], [1]]))).toBe('row order differs under ORDER BY');
    expect(compare('MATCH (n) WITH n ORDER BY n.x LIMIT 2 RETURN n.x', ok([[1], [2]]), ok([[2], [1]]))).toBeNull();
  });

  // @lat: [[tests/engine-conformance#Column kinds must agree]]
  it('flags different column kinds or names', () => {
    expect(compare('RETURN 1', ok([[1]], ['node']), ok([[1]], ['scalar']))).toBe('column kinds differ');
    expect(compare('RETURN 1', ok([[1]]), { ok: false, error: 'runtime' })).toMatch(/only one engine failed: ladybug/);
  });

  // @lat: [[tests/engine-conformance#Unexpected divergence fails]]
  it('reports an undocumented divergence with both results, and summarizes', async () => {
    const { classify } = await import('../conformance/compare.js');
    const o = classify({ id: 'x', query: 'RETURN 1' }, ok([[1]]), ok([[2]]));
    expect(o).toEqual({ kind: 'divergence', reason: 'rows differ', builtin: ok([[1]]), ladybug: ok([[2]]) });
    expect(summarize([o, { kind: 'match' }, { kind: 'skipped', reason: 'r' }])).toEqual({ match: 1, 'expected-difference': 0, divergence: 1, skipped: 1 });
    expect(classify({ id: 'y', query: 'UNWIND [1] AS x RETURN x', difference: 'unwind' }, { ok: false, error: 'unsupported' }, ok([[1]]))).toEqual({ kind: 'expected-difference', difference: 'unwind' });
  });

  // @lat: [[tests/engine-conformance#Registry entries checked]]
  it('fails documented differences without a query, stale ones and unknown citations', () => {
    const diffs = [
      { id: 'a', construct: 'A', builtin: '', ladybug: '' },
      { id: 'b', construct: 'B', builtin: '', ladybug: '' },
    ];
    const corpus = [
      { id: 'q1', query: 'RETURN 1', difference: 'b' },
      { id: 'q2', query: 'RETURN 2', difference: 'zzz' },
    ];
    const outcomes = new Map([['q1', { kind: 'match' as const }]]);
    expect(checkRegistry(diffs, corpus, outcomes)).toEqual([
      { difference: 'zzz', problem: 'unknown' },
      { difference: 'a', problem: 'no-query' },
      { difference: 'b', problem: 'stale' },
    ]);
  });
});
