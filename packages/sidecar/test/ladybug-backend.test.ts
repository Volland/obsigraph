import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LadybugBackend } from '../src/ladybug/backend.js';
import { assertReadOnly } from '../src/ladybug/guard.js';
import { startSidecar, type Sidecar } from '../src/main.js';
import { loadLadybug } from '../src/mirror/store.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const available = 'lbug' in (await loadLadybug());
let sc: Sidecar;
let vault: string;
let root: string;

const NOTES: Record<string, string> = {
  'Alice.md': '---\ntype: Person\nage: 31\nname: Al\n---\nknows:: [[Bob]] {since: 2020}\nknows:: [[Carol]] {since: 2018}\n-distrusts:: [[Eve]]\nrated:: [[Movie]] {score: 4}',
  'Bob.md': '---\ntype: [Person, Employee]\nage: 40\n---\nknows:: [[Carol]] {since: 2021}\nworksAt:: [[Acme]]',
  'Carol.md': '---\ntype: Person\n---\nknows:: [[Alice]]\nlikes:: [[Ghost]]',
  'Eve.md': '---\ntype: Person\n---\n',
  'Acme.md': '---\ntype: Company\n---\n',
  'Movie.md': '',
};

const post = async (query: string, backend?: string): Promise<{ status: number; body: Json }> => {
  const res = await fetch(`http://127.0.0.1:${sc.port}/query`, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ query, ...(backend ? { backend } : {}) }) });
  return { status: res.status, body: await res.json() };
};
const both = async (q: string) => [await post(q, 'builtin'), await post(q, 'ladybug')] as const;

beforeAll(async () => {
  if (!available) return;
  root = mkdtempSync(join(tmpdir(), 'obsigraph-lbb-'));
  vault = join(root, 'vault');
  mkdirSync(vault);
  mkdirSync(join(root, 'data'));
  for (const [p, t] of Object.entries(NOTES)) writeFileSync(join(vault, p), t);
  sc = await startSidecar({ OBSIGRAPH_VAULT: vault, OBSIGRAPH_DATA: join(root, 'data'), OBSIGRAPH_TOKEN: 't', OBSIGRAPH_PORT: '0', OBSIGRAPH_VECTORS: '0', OBSIGRAPH_DEBOUNCE_MS: '30' }, { log: () => {} });
  await sc.mirror!.idle();
});
afterAll(async () => {
  await sc?.stop();
  if (root) rmSync(root, { recursive: true, force: true });
});

describe.skipIf(!available)('ladybug backend', () => {
  // @lat: [[tests/ladybug-backend#Same columns and values]]
  it('returns the same columns, kinds and tagged values as the built-in engine', async () => {
    for (const q of [
      'MATCH (a {title: "Alice"})-[r:knows]->(b) RETURN a, r.since ORDER BY r.since',
      'MATCH (a:Person)-[r:knows]->(b) WHERE r.since > 2019 RETURN a, r, b ORDER BY a.title',
      'MATCH (n:Employee) RETURN n',
      'MATCH (p:Person) OPTIONAL MATCH (p)-[:worksAt]->(c) RETURN p.title, c.title ORDER BY p.title',
      'MATCH (a)-[:knows]->(b) WITH a, count(b) AS n WHERE n > 1 RETURN a.title, n',
      'MATCH (a {title: "Alice"})-[:knows*1..2]->(b) RETURN DISTINCT b.title AS t ORDER BY t',
      'MATCH (n:Person) WHERE n.name = "Al" AND n.missing IS NULL RETURN toUpper(n.title) AS u',
      'MATCH (a)-[:nope]->(b) RETURN count(*) AS n',
    ]) {
      const [b, l] = await both(q);
      expect(l.status, q).toBe(200);
      expect(l.body.columns, q).toEqual(b.body.columns);
      expect(l.body.rows, q).toEqual(b.body.rows);
    }
  });

  // @lat: [[tests/ladybug-backend#Full Cypher for reads]]
  it('runs read syntax the built-in engine does not support', async () => {
    expect((await post('UNWIND [1, 2, 3] AS x RETURN sum(x) AS s', 'builtin')).status).toBe(400);
    const l = await post('UNWIND [1, 2, 3] AS x RETURN sum(x) AS s', 'ladybug');
    expect(l.status).toBe(200);
    expect(l.body.rows).toEqual([[6]]);
    expect(l.body.notices[0]).toMatch(/untranslated/);
  });

  // @lat: [[tests/ladybug-backend#Writes rejected]]
  it('rejects writes, hidden writes, multiple statements and schema statements', async () => {
    for (const q of [
      "MATCH (n) SET n.title = 'x'",
      'MATCH (n) WITH n CREATE (m:Node {id: "z"}) RETURN m',
      'MATCH (n) RETURN n; CREATE (m:Node {id: "z"})',
      'CREATE NODE TABLE X(id STRING PRIMARY KEY)',
      'DROP TABLE Node',
      'CALL show_tables() RETURN *',
      'MATCH (n:Node) DETACH DELETE n',
    ]) {
      const r = await post(q, 'ladybug');
      expect(r.status, q).toBe(400);
      expect(r.body.error.kind, q).toBe('readonly');
    }
    const after = await post('MATCH (n) WHERE n.stub = false RETURN count(n) AS n', 'ladybug');
    expect(after.body.rows).toEqual([[6]]);
  });

  // @lat: [[tests/ladybug-backend#Keywords in strings allowed]]
  it('does not reject keywords inside strings, comments, properties or labels', async () => {
    expect(() => assertReadOnly("MATCH (n) WHERE n.title = 'DELETE me' RETURN n // DROP everything")).not.toThrow();
    expect(() => assertReadOnly('MATCH (n:Create) WHERE n.set = 1 RETURN n /* SET */')).not.toThrow();
    const r = await post("MATCH (n) WHERE n.title = 'DELETE' RETURN count(n) AS c // CREATE", 'ladybug');
    expect(r.status).toBe(200);
    expect(r.body.rows).toEqual([[0]]);
  });

  // @lat: [[tests/ladybug-backend#Negative edges filter]]
  it('filters negative edges by r.sign like the built-in engine', async () => {
    const [b, l] = await both('MATCH (a)-[r]->(b) WHERE r.sign = -1 RETURN a.title, b.title, r.id');
    expect(l.body.rows).toEqual([['Alice', 'Eve', 'Alice.md#distrusts#Eve.md#0']]);
    expect(l.body.rows).toEqual(b.body.rows);
  });

  // @lat: [[tests/ladybug-backend#Unknown backend rejected]]
  it('rejects an unknown backend value', async () => {
    const r = await post('MATCH (n) RETURN n', 'neo4j');
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/"builtin" or "ladybug"/);
  });

  // @lat: [[tests/ladybug-backend#Unavailable and not ready]]
  it('answers 503 when Ladybug is unavailable or the mirror is not ready', async () => {
    const r2 = mkdtempSync(join(tmpdir(), 'obsigraph-lbb-off-'));
    mkdirSync(join(r2, 'vault'));
    mkdirSync(join(r2, 'data'));
    const off = await startSidecar({ OBSIGRAPH_VAULT: join(r2, 'vault'), OBSIGRAPH_DATA: join(r2, 'data'), OBSIGRAPH_TOKEN: 't', OBSIGRAPH_PORT: '0', OBSIGRAPH_VECTORS: '0', OBSIGRAPH_LADYBUG: '0' }, { log: () => {} });
    const res = await fetch(`http://127.0.0.1:${off.port}/query`, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ query: 'MATCH (n) RETURN n', backend: 'ladybug' }) });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: { kind: 'unavailable', message: 'disabled by OBSIGRAPH_LADYBUG=0' } });
    await off.stop();
    rmSync(r2, { recursive: true, force: true });

    const fresh = { ...sc.mirror!, ready: false, status: () => ({ state: 'syncing' }), idle: async () => {} } as never;
    const backend = new LadybugBackend(sc.mirror!.store as never, fresh, sc.sync, { maxPathDepth: 10, timeoutMs: 1000 });
    await expect(backend.run('MATCH (n) RETURN n')).rejects.toMatchObject({ kind: 'not_ready' });
  });

  // @lat: [[tests/ladybug-backend#Edit then query]]
  it('includes an edge as soon as the built-in engine sees it', async () => {
    writeFileSync(join(vault, 'Eve.md'), '---\ntype: Person\n---\nknows:: [[Acme]] {since: 1999}');
    const end = Date.now() + 5000;
    while (Date.now() < end) {
      const b = await post('MATCH (e {title: "Eve"})-[r:knows]->(x) RETURN x.title, r.since', 'builtin');
      if (b.body.rows.length) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    const l = await post('MATCH (e {title: "Eve"})-[r:knows]->(x) RETURN x.title, r.since', 'ladybug');
    expect(l.body.rows).toEqual([['Acme', 1999]]);
  });

  // @lat: [[tests/ladybug-backend#Stale results flagged]]
  it('answers with a staleness notice when a sync does not settle in time', async () => {
    const busy = { ...sc.sync, graph: sc.sync.graph, idle: () => new Promise<void>(() => {}) } as never;
    const backend = new LadybugBackend(sc.mirror!.store as never, sc.mirror!, busy, { maxPathDepth: 10, timeoutMs: 1000, freshnessWaitMs: 20 });
    const r = await backend.run('MATCH (n:Company) RETURN n.title');
    expect(r.rows).toEqual([['Acme']]);
    expect(r.notices).toContain('The Ladybug mirror is syncing; results may be stale.');
    backend.close();
  });

  // @lat: [[tests/ladybug-backend#Errors with position]]
  it('reports syntax errors with a position', async () => {
    const r = await post('MATCH (a RETURN a', 'ladybug');
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ kind: 'syntax', line: 1, column: 10 });
  });
});
