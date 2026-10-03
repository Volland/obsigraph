import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BuiltinEngine, CypherError, resultToJson } from '@obsigraph/core';
import { startSidecar, type Sidecar } from '../src/main.js';
import { loadLadybug } from '../src/mirror/store.js';
import { classify, type CorpusEntry, type Difference, type EngineOutcome, type Outcome } from './compare.js';

export const FIXTURE = join(import.meta.dirname, 'fixture');
export const CORPUS_FILE = join(import.meta.dirname, 'corpus.json');

export const loadCorpus = (): CorpusEntry[] => JSON.parse(readFileSync(CORPUS_FILE, 'utf8')) as CorpusEntry[];
export const loadDifferences = (): Difference[] => JSON.parse(readFileSync(join(import.meta.dirname, 'differences.json'), 'utf8')) as Difference[];

export interface RunReport {
  entries: CorpusEntry[];
  builtin: Map<string, EngineOutcome>;
  ladybug: Map<string, EngineOutcome> | null;
  skipReason: string | null;
  outcomes: Map<string, Outcome>;
}

/** Run every corpus query on both engines over the fixture vault. */
// @lat: [[query-engine#Two backends]]
export async function runCorpus(entries = loadCorpus(), opts: { ladybug?: boolean } = {}): Promise<RunReport> {
  const data = mkdtempSync(join(tmpdir(), 'obsigraph-conformance-'));
  const hasLadybug = opts.ladybug !== false && 'lbug' in (await loadLadybug());
  let sc: Sidecar | null = null;
  try {
    sc = await startSidecar(
      { OBSIGRAPH_VAULT: FIXTURE, OBSIGRAPH_DATA: data, OBSIGRAPH_TOKEN: 'conformance', OBSIGRAPH_PORT: '0', OBSIGRAPH_LADYBUG: hasLadybug ? '1' : '0' },
      { log: () => {} },
    );
    await sc.mirror?.idle();
    const engine = new BuiltinEngine(sc.sync.graph);
    const builtin = new Map<string, EngineOutcome>();
    const ladybug = hasLadybug ? new Map<string, EngineOutcome>() : null;
    for (const e of entries) {
      try {
        builtin.set(e.id, { ok: true, result: JSON.parse(JSON.stringify(resultToJson(engine.run(e.query)))) });
      } catch (err) {
        if (!(err instanceof CypherError)) throw err;
        builtin.set(e.id, { ok: false, error: err.kind });
      }
      if (ladybug) {
        const res = await fetch(`http://127.0.0.1:${sc.port}/query`, {
          method: 'POST',
          headers: { authorization: 'Bearer conformance' },
          body: JSON.stringify({ query: e.query, backend: 'ladybug' }),
        });
        const body = (await res.json()) as { error?: { kind: string }; columns?: unknown };
        if (res.status === 200) {
          const { notices: _n, ...result } = body as never as { notices?: unknown };
          ladybug.set(e.id, { ok: true, result: result as never });
        } else ladybug.set(e.id, { ok: false, error: body.error?.kind ?? `http ${res.status}` });
      }
    }
    const skipReason = hasLadybug ? null : opts.ladybug === false ? 'Ladybug comparison disabled' : 'LadybugDB is not installed';
    const outcomes = new Map(entries.map((e) => [e.id, classify(e, builtin.get(e.id)!, ladybug?.get(e.id) ?? null, skipReason ?? undefined)]));
    return { entries, builtin, ladybug, skipReason, outcomes };
  } finally {
    await sc?.stop();
    rmSync(data, { recursive: true, force: true });
  }
}
