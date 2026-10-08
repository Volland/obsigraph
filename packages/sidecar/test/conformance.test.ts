import { writeFileSync } from 'node:fs';
import { AGGREGATE_FUNCTIONS, BINARY_OPERATORS, BuiltinEngine, CLAUSES, CypherError, FUNCTIONS, parseQuery, PATTERN_FEATURES, queryConstructs, UNARY_OPERATORS } from '@obsigraph/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkRegistry, compare, formatReport, summarize, type EngineOutcome } from '../conformance/compare.mjs';
import { CORPUS_FILE, loadCorpus, loadDifferences, runCorpus, type RunReport } from '../conformance/runner.mjs';
import { startSidecar } from '../src/main.mjs';
import { FIXTURE } from '../conformance/runner.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let report: RunReport;
let printed: string[];
beforeAll(async () => {
  printed = [];
  report = await runCorpus(loadCorpus(), { print: (t) => printed.push(t) });
  if (process.env.OBSIGRAPH_RECORD === '1') {
    const corpus = loadCorpus().map((e) => ({ ...e, expected: report.builtin.get(e.id) }));
    writeFileSync(CORPUS_FILE, `${JSON.stringify(corpus, null, 2)}\n`);
  }
}, 120000);

describe('engine conformance suite', () => {
  // @lat: [[tests/engine-conformance#Both engines run the corpus]]
  // @tg: verifies:: [[openspec:engine-conformance#Shared corpus on a fixed fixture#Both engines run]]
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
  // @tg: verifies:: [[openspec:engine-conformance#Graceful skip when Ladybug is unavailable#Ladybug not installed in CI]]
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
  // @tg: verifies:: [[openspec:engine-conformance#Write rejection conformance#Both reject writes]]
  it('rejects writes on both engines and leaves the fixture unchanged', async () => {
    const data = mkdtempSync(join(tmpdir(), 'obsigraph-conf-w-'));
    const sc = await startSidecar({ OBSIGRAPH_VAULT: FIXTURE, OBSIGRAPH_DATA: data, OBSIGRAPH_TOKEN: 't', OBSIGRAPH_PORT: '0', OBSIGRAPH_VECTORS: '0' }, { log: () => {} });
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
  // @tg: verifies:: [[openspec:engine-conformance#Corpus grows with the supported subset#New clause added]]
  // @tg: verifies:: [[openspec:engine-conformance#Corpus grows with the supported subset#New function added]]
  it('has a corpus query for every supported clause, operator, function and aggregate', () => {
    const used = new Set<string>();
    for (const e of report.entries) {
      try {
        for (const c of queryConstructs(parseQuery(e.query))) used.add(c);
      } catch (err) {
        if (!(err instanceof CypherError)) throw err;
      }
    }
    const subset = [...CLAUSES, ...PATTERN_FEATURES, ...Object.values(BINARY_OPERATORS), ...UNARY_OPERATORS, ...FUNCTIONS, ...AGGREGATE_FUNCTIONS];
    expect(subset.filter((c) => !used.has(c))).toEqual([]);
    // A construct only mentioned in a string or a property name does not count.
    expect(queryConstructs(parseQuery("MATCH (n) WHERE n.title = 'ORDER BY toLower(x)' RETURN n.limit"))).toEqual(new Set(['MATCH', 'WHERE', '=', 'RETURN']));
  });

  // @lat: [[tests/engine-conformance#Report printed with counts]]
  // @tg: verifies:: [[openspec:engine-conformance#Divergences are reported and fail the run#All match]]
  it('prints a report listing each query and the counts per outcome', () => {
    expect(printed).toEqual([report.text]);
    const counts = summarize(report.outcomes.values());
    for (const e of report.entries) expect(report.text).toContain(` ${e.id}`);
    expect(report.text).toContain(`${counts.match} match, ${counts['expected-difference']} expected difference, ${counts.divergence} divergence, ${counts.skipped} skipped`);
  });

  // @lat: [[tests/engine-conformance#Write clauses in the corpus]]
  // @tg: verifies:: [[openspec:engine-conformance#Write rejection conformance#Both reject writes]]
  it('keeps CREATE, MERGE, SET, DELETE and REMOVE in the corpus, read-only on both engines', () => {
    for (const clause of ['CREATE', 'MERGE', 'SET', 'DELETE', 'REMOVE']) {
      const entries = report.entries.filter((e) => new RegExp(`\\b${clause}\\b`).test(e.query));
      expect(entries.length, clause).toBeGreaterThan(0);
      for (const e of entries) {
        expect(e.expected, e.id).toEqual({ ok: false, error: 'readonly' });
        expect(report.builtin.get(e.id), e.id).toEqual({ ok: false, error: 'readonly' });
        if (report.ladybug) expect(report.ladybug.get(e.id), e.id).toEqual({ ok: false, error: 'readonly' });
      }
    }
  });

  // @lat: [[tests/engine-conformance#Fixture coverage]]
  // @tg: verifies:: [[openspec:engine-conformance#Shared corpus on a fixed fixture#Fixture coverage]]
  it('uses a fixture with multi-labels, stubs, signed, pinned and parallel edges and edge properties', async () => {
    const g = await (async () => {
      const data = mkdtempSync(join(tmpdir(), 'obsigraph-conf-f-'));
      const sc = await startSidecar({ OBSIGRAPH_VAULT: FIXTURE, OBSIGRAPH_DATA: data, OBSIGRAPH_TOKEN: 't', OBSIGRAPH_PORT: '0', OBSIGRAPH_VECTORS: '0', OBSIGRAPH_LADYBUG: '0' }, { log: () => {} });
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
  // @tg: verifies:: [[openspec:engine-conformance#Comparison rules#Unordered query]]
  it('treats rows as a multiset without ORDER BY', () => {
    expect(compare('MATCH (n) RETURN n.x', ok([[1], [2]]), ok([[2], [1]]))).toBeNull();
    expect(compare('MATCH (n) RETURN n.x', ok([[1], [1]]), ok([[1], [2]]))).toBe('rows differ');
  });

  // @lat: [[tests/engine-conformance#Order matters under ORDER BY]]
  // @tg: verifies:: [[openspec:engine-conformance#Comparison rules#Ordered query]]
  it('requires the same order under ORDER BY', () => {
    expect(compare('MATCH (n) RETURN n.x ORDER BY n.x', ok([[1], [2]]), ok([[2], [1]]))).toBe('row order differs under ORDER BY');
    expect(compare('MATCH (n) WITH n ORDER BY n.x LIMIT 2 RETURN n.x', ok([[1], [2]]), ok([[2], [1]]))).toBeNull();
  });

  // @lat: [[tests/engine-conformance#Column kinds must agree]]
  // @tg: verifies:: [[openspec:engine-conformance#Comparison rules#Different column kind]]
  it('flags different column kinds or names', () => {
    expect(compare('RETURN 1', ok([[1]], ['node']), ok([[1]], ['scalar']))).toBe('column kinds differ');
    expect(compare('RETURN 1', ok([[1]]), { ok: false, error: 'runtime' })).toMatch(/only one engine failed: ladybug/);
  });

  // @lat: [[tests/engine-conformance#Unexpected divergence fails]]
  // @tg: verifies:: [[openspec:engine-conformance#Divergences are reported and fail the run#Unexpected divergence]]
  // @tg: verifies:: [[openspec:engine-conformance#Documented intentional differences#Construct unsupported in-plugin]]
  it('reports an undocumented divergence with both results, and summarizes', async () => {
    const { classify } = await import('../conformance/compare.mjs');
    const o = classify({ id: 'x', query: 'RETURN 1' }, ok([[1]]), ok([[2]]));
    expect(o).toEqual({ kind: 'divergence', reason: 'rows differ', builtin: ok([[1]]), ladybug: ok([[2]]) });
    expect(summarize([o, { kind: 'match' }, { kind: 'skipped', reason: 'r' }])).toEqual({ match: 1, 'expected-difference': 0, divergence: 1, skipped: 1 });
    const unwind = [{ id: 'unwind', construct: 'UNWIND', builtin: '', ladybug: '', outcomes: { builtin: 'unsupported', ladybug: 'ok' } }];
    expect(classify({ id: 'y', query: 'UNWIND [1] AS x RETURN x', difference: 'unwind' }, { ok: false, error: 'unsupported' }, ok([[1]]), undefined, unwind)).toEqual({ kind: 'expected-difference', difference: 'unwind' });
    const text = formatReport([{ id: 'x', query: 'RETURN 1' }], new Map([['x', o]]));
    expect(text).toContain('builtin: ');
    expect(text).toContain('ladybug: ');
    expect(text).toContain('0 match, 0 expected difference, 1 divergence, 0 skipped');
  });

  // @lat: [[tests/engine-conformance#Expected difference must match its nature]]
  // @tg: verifies:: [[openspec:engine-conformance#Divergences are reported and fail the run#Unexpected divergence]]
  it('accepts a cited difference only when the divergence matches its documented nature', async () => {
    const { classify } = await import('../conformance/compare.mjs');
    const diffs = [{ id: 'unwind', construct: 'UNWIND', builtin: '', ladybug: '', outcomes: { builtin: 'unsupported', ladybug: 'ok' } }];
    const entry = { id: 'y', query: 'UNWIND [1] AS x RETURN x', difference: 'unwind' };
    // Both engines answer but with different rows: not what the entry documents.
    const wrongRows = classify(entry, ok([[1]]), ok([[2]]), undefined, diffs);
    expect(wrongRows).toMatchObject({ kind: 'divergence', reason: expect.stringMatching(/not the documented difference unwind/) });
    // The engines fail the other way round.
    expect(classify(entry, ok([[1]]), { ok: false, error: 'runtime' }, undefined, diffs).kind).toBe('divergence');
    // A citation of a difference that is not documented never excuses a divergence.
    expect(classify({ ...entry, difference: 'nope' }, { ok: false, error: 'unsupported' }, ok([[1]]), undefined, diffs)).toMatchObject({ kind: 'divergence', reason: expect.stringMatching(/unknown difference nope/) });
  });

  // @lat: [[tests/engine-conformance#Registry entries checked]]
  // @tg: verifies:: [[openspec:engine-conformance#Documented intentional differences#Entry without a query]]
  // @tg: verifies:: [[openspec:engine-conformance#Documented intentional differences#Stale entry]]
  it('fails documented differences without a query, stale ones and unknown citations', () => {
    const diffs = [
      { id: 'a', construct: 'A', builtin: '', ladybug: '', outcomes: { builtin: 'ok', ladybug: 'unsupported' } },
      { id: 'b', construct: 'B', builtin: '', ladybug: '', outcomes: { builtin: 'ok', ladybug: 'unsupported' } },
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
