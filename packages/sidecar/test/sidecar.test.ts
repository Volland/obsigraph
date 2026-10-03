import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BuiltinEngine, Graph, pathResolver, resultToJson } from '@obsigraph/core';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';
import { tokenMatches } from '../src/http.js';
import { startSidecar, type Sidecar } from '../src/main.js';
import type { Processor } from '../src/sync.js';

const TOKEN = 'test-token-0123456789';
const running: Sidecar[] = [];
const dirs: string[] = [];

function fixture(files: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'obsigraph-sidecar-'));
  dirs.push(root);
  const vault = join(root, 'vault');
  const data = join(root, 'data');
  mkdirSync(vault);
  mkdirSync(data);
  const notes = {
    'Alice.md': '---\ntype: Person\nage: 31\n---\nknows:: [[Bob]] {since: 2020}\n-distrusts:: [[Eve]]',
    'People/Bob.md': '---\ntype: [Person, Employee]\n---\nknows:: [[Carol]]',
    'Carol.md': 'likes:: [[Ghost]]',
    'Eve.md': '',
    '.obsidian/workspace.md': 'knows:: [[Hidden]]',
    ...files,
  };
  for (const [p, text] of Object.entries(notes)) write(vault, p, text);
  return { root, vault, data };
}

function write(vault: string, path: string, text: string) {
  const full = join(vault, ...path.split('/'));
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, text);
}

function env(f: { vault: string; data: string }, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { OBSIGRAPH_VAULT: f.vault, OBSIGRAPH_DATA: f.data, OBSIGRAPH_TOKEN: TOKEN, OBSIGRAPH_PORT: '0', OBSIGRAPH_VECTORS: '0', OBSIGRAPH_DEBOUNCE_MS: '40', OBSIGRAPH_LADYBUG: '0', ...extra };
}

async function start(e: NodeJS.ProcessEnv, processors: Processor[] = [], logs: string[] = []) {
  const sc = await startSidecar(e, processors, (m) => logs.push(m));
  running.push(sc);
  return sc;
}

const call = (sc: Sidecar, path: string, init: RequestInit & { token?: string | null } = {}) => {
  const headers = new Headers(init.headers);
  const token = init.token === undefined ? TOKEN : init.token;
  if (token) headers.set('authorization', `Bearer ${token}`);
  return fetch(`http://127.0.0.1:${sc.port}${path}`, { ...init, headers });
};
// Test helper: response bodies are asserted structurally, so treat them as loose JSON.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (res: Response): Promise<any> => res.json();
const query = (sc: Sidecar, q: string, token?: string | null) =>
  call(sc, '/query', { method: 'POST', body: JSON.stringify({ query: q }), headers: { 'content-type': 'application/json' }, token });

async function until(cond: () => boolean | Promise<boolean>, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('condition not met in time');
}

function treeHash(dir: string): string {
  const h = createHash('sha256');
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      const s = statSync(full);
      h.update(`${full}:${s.mode}:${s.size}:${s.mtimeMs}`);
      if (s.isDirectory()) walk(full);
      else h.update(readFileSync(full));
    }
  };
  walk(dir);
  return h.digest('hex');
}

function recorder(): Processor & { upserts: string[]; removes: string[] } {
  const r = {
    name: 'recorder',
    upserts: [] as string[],
    removes: [] as string[],
    upsert(note: { path: string }) {
      r.upserts.push(note.path);
    },
    remove(path: string) {
      r.removes.push(path);
    },
  };
  return r;
}

afterEach(async () => {
  for (const sc of running.splice(0)) await sc.stop();
  for (const d of dirs.splice(0)) {
    chmodRecursive(d, 0o755);
    rmSync(d, { recursive: true, force: true });
  }
});

function chmodRecursive(dir: string, mode: number) {
  try {
    chmodSync(dir, mode);
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) chmodRecursive(full, mode);
      else chmodSync(full, 0o644);
    }
  } catch {
    /* already gone */
  }
}

describe('sidecar service', () => {
  // @lat: [[tests/sidecar-service#Read-only vault]]
  it('indexes a read-only vault and writes only into the data directory', async () => {
    const f = fixture();
    for (const p of ['Alice.md', 'Carol.md', 'Eve.md', 'People/Bob.md', '.obsidian/workspace.md']) chmodSync(join(f.vault, ...p.split('/')), 0o444);
    for (const d of ['People', '.obsidian', '']) chmodSync(join(f.vault, d), 0o555);
    const before = treeHash(f.vault);
    const sc = await start(env(f));
    const r = await (await json(await query(sc, 'MATCH (n) WHERE n.stub = false RETURN count(n) AS n')));
    expect(r.rows).toEqual([[4]]);
    await sc.stop();
    running.splice(running.indexOf(sc), 1);
    expect(treeHash(f.vault)).toBe(before);
    expect(readdirSync(f.data)).toEqual(['sync-state.json']);
  });

  // @lat: [[tests/sidecar-service#Data directory required]]
  it('refuses to start without a writable data directory, naming it', () => {
    const f = fixture();
    const missing = join(f.root, 'nope');
    expect(() => loadConfig(env(f, { OBSIGRAPH_DATA: missing }))).toThrow(new ConfigError(`Data directory ${missing} is missing or not writable (set OBSIGRAPH_DATA to a writable volume)`));
    expect(() => loadConfig(env(f, { OBSIGRAPH_DATA: join(f.vault, 'People') }))).toThrow(/must be outside the vault/);
  });

  // @lat: [[tests/sidecar-service#Same results as plugin engine]]
  it('returns the same columns and rows as the plugin engine on the same vault', async () => {
    const f = fixture();
    const sc = await start(env(f));
    const notes = {
      'Alice.md': { text: readFileSync(join(f.vault, 'Alice.md'), 'utf8'), frontmatter: { type: 'Person', age: 31 } },
      'People/Bob.md': { text: readFileSync(join(f.vault, 'People/Bob.md'), 'utf8'), frontmatter: { type: ['Person', 'Employee'] } },
      'Carol.md': { text: 'likes:: [[Ghost]]', frontmatter: null },
      'Eve.md': { text: '', frontmatter: null },
    };
    const graph = new Graph(pathResolver(() => Object.keys(notes)));
    for (const [path, n] of Object.entries(notes)) graph.upsertNote({ path, ...n });
    const engine = new BuiltinEngine(graph);
    for (const q of [
      'MATCH (a:Person)-[r:knows]->(b) RETURN a, r, b ORDER BY a.title',
      'MATCH (a)-[r]->(b) WHERE r.sign = -1 RETURN a.title, r.id, b.title',
      'MATCH (n) RETURN n.title, n.stub, labels(n) ORDER BY n.title',
      'MATCH p = (a {title: "Alice"})-[*1..2]->(c) RETURN p ORDER BY length(p)',
    ]) {
      const remote = await (await json(await query(sc, q)));
      expect(remote, q).toEqual(JSON.parse(JSON.stringify(resultToJson(engine.run(q)))));
    }
  });

  // @lat: [[tests/sidecar-service#First start indexes everything]]
  it('indexes every note on first start and reports ready', async () => {
    const f = fixture();
    const rec = recorder();
    const sc = await start(env(f), [rec]);
    expect(rec.upserts.sort()).toEqual(['Alice.md', 'Carol.md', 'Eve.md', 'People/Bob.md']);
    const status = await (await json(await call(sc, '/status')));
    expect(status).toMatchObject({ state: 'ready', notes: 4, edges: 4, pending: 0 });
    expect(typeof status.lastSync).toBe('string');
  });

  // @lat: [[tests/sidecar-service#Restart reprocesses only changes]]
  it('hands only notes changed while stopped to processors after a restart', async () => {
    const f = fixture();
    await (await start(env(f))).stop();
    running.pop();
    write(f.vault, 'Alice.md', 'knows:: [[Bob]] {since: 2021}');
    write(f.vault, 'New.md', 'knows:: [[Alice]]');
    rmSync(join(f.vault, 'Eve.md'));
    const rec = recorder();
    const sc = await start(env(f), [rec]);
    expect(rec.upserts.sort()).toEqual(['Alice.md', 'New.md']);
    expect(rec.removes).toEqual(['Eve.md']);
    expect(sc.sync.status().lastReconciled.sort()).toEqual(['Alice.md', 'Eve.md', 'New.md']);
  });

  // @lat: [[tests/sidecar-service#Live edit becomes queryable]]
  it('makes a new edge queryable after an edit', async () => {
    const f = fixture();
    const sc = await start(env(f));
    write(f.vault, 'Eve.md', 'knows:: [[Carol]] {since: 1999}');
    await until(async () => (await json(await (await query(sc, "MATCH (:Person)-[r:knows]->() WHERE r.since = 1999 RETURN r")))).rows?.length === 0 &&
      (await json(await (await query(sc, 'MATCH ({title: "Eve"})-[r:knows]->(c) RETURN c.title')))).rows.length === 1);
    write(f.vault, 'Later/Zed.md', 'knows:: [[Eve]]');
    await until(async () => (await json(await (await query(sc, 'MATCH (z {title: "Zed"})-->(e) RETURN e.title')))).rows.length === 1);
    rmSync(join(f.vault, 'Later/Zed.md'));
    await until(async () => (await json(await (await query(sc, 'MATCH (z {title: "Zed"}) RETURN z')))).rows.length === 0);
  });

  // @lat: [[tests/sidecar-service#Burst of saves coalesced]]
  it('processes a burst of saves to one file once', async () => {
    const f = fixture();
    const rec = recorder();
    const sc = await start(env(f, { OBSIGRAPH_DEBOUNCE_MS: '150' }), [rec]);
    rec.upserts.length = 0;
    for (let i = 0; i < 10; i++) write(f.vault, 'Carol.md', `likes:: [[Ghost]] {n: ${i}}`);
    await new Promise((r) => setTimeout(r, 100));
    await until(() => rec.upserts.length > 0);
    await sc.sync.idle();
    expect(rec.upserts).toEqual(['Carol.md']);
  });

  // @lat: [[tests/sidecar-service#Polling fallback]]
  it('detects changes by polling when native events are missing', async () => {
    const f = fixture();
    const rec = recorder();
    const sc = await start(env(f, { OBSIGRAPH_POLL_MS: '60' }), [rec]);
    // Stop native events to simulate a mount that does not deliver them.
    (sc.sync as unknown as { watcher: { close(): void } | null }).watcher?.close();
    rec.upserts.length = 0;
    write(f.vault, 'Eve.md', 'knows:: [[Alice]]');
    const t = new Date(Date.now() + 5000);
    utimesSync(join(f.vault, 'Eve.md'), t, t);
    await until(() => rec.upserts.includes('Eve.md'));
  });

  // @lat: [[tests/sidecar-service#Writes rejected over REST]]
  it('rejects write Cypher with a client error naming the clause', async () => {
    const f = fixture();
    const sc = await start(env(f));
    const res = await query(sc, 'CREATE (n:Person)');
    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({ error: { kind: 'readonly', message: 'Queries are read-only: CREATE is not allowed', line: 1, column: 1 } });
    expect(sc.sync.status().notes).toBe(4);
  });

  // @lat: [[tests/sidecar-service#Health and status]]
  it('serves health without a token and status with one', async () => {
    const f = fixture();
    const sc = await start(env(f));
    const health = await call(sc, '/health', { token: null });
    expect(health.status).toBe(200);
    expect(await json(health)).toEqual({ status: 'ok' });
    const status = await (await json(await call(sc, '/status')));
    expect(Object.keys(status).sort()).toEqual(['edges', 'embeddingModel', 'frontmatterErrors', 'lastSync', 'mirror', 'notes', 'pending', 'state', 'vectors']);
    expect(status.mirror).toEqual({ state: 'disabled', message: 'disabled by OBSIGRAPH_LADYBUG=0' });
    expect((await call(sc, '/nowhere')).status).toBe(404);
    expect((await call(sc, '/query')).status).toBe(405);
  });

  // @lat: [[tests/sidecar-service#Query contract over REST]]
  it('returns the {columns, rows} contract with tagged graph values', async () => {
    const f = fixture();
    const sc = await start(env(f));
    const r = await (await json(await query(sc, 'MATCH (a {title: "Alice"})-[r:knows]->(b) RETURN a, r, r.since')));
    expect(r.columns).toEqual([{ name: 'a', kind: 'node' }, { name: 'r', kind: 'relationship' }, { name: 'r.since', kind: 'scalar' }]);
    expect(r.rows[0][0]).toMatchObject({ _type: 'node', id: 'Alice.md', labels: ['Person'], stub: false, properties: { age: 31, title: 'Alice' } });
    expect(r.rows[0][1]).toEqual({ _type: 'relationship', id: 'Alice.md#knows#People/Bob.md#0', type: 'knows', sign: 1, source: 'Alice.md', target: 'People/Bob.md', properties: { since: 2020 } });
    expect(r.rows[0][2]).toBe(2020);
  });

  // @lat: [[tests/sidecar-service#Token required]]
  it('rejects missing or wrong tokens with 401 and never logs the token', async () => {
    const f = fixture();
    const logs: string[] = [];
    const sc = await start(env(f), [], logs);
    expect((await query(sc, 'MATCH (n) RETURN n', null)).status).toBe(401);
    expect((await query(sc, 'MATCH (n) RETURN n', 'wrong')).status).toBe(401);
    expect((await call(sc, '/status', { token: null })).status).toBe(401);
    expect(tokenMatches(TOKEN, `Bearer ${TOKEN}`)).toBe(true);
    expect(tokenMatches(TOKEN, `Bearer ${TOKEN}x`)).toBe(false);
    expect(logs.join('\n')).not.toContain(TOKEN);
  });

  // @lat: [[tests/sidecar-service#No token refuses to start]]
  it('refuses to start without a token unless explicitly overridden on loopback', () => {
    const f = fixture();
    const e = env(f, { OBSIGRAPH_TOKEN: '' });
    expect(() => loadConfig(e)).toThrow(/No token configured/);
    expect(loadConfig({ ...e, OBSIGRAPH_ALLOW_NO_AUTH: '1' }).token).toBeNull();
    expect(() => loadConfig({ ...e, OBSIGRAPH_ALLOW_NO_AUTH: '1', OBSIGRAPH_HOST: '0.0.0.0' })).toThrow(/non-loopback/);
    const file = join(f.root, 'token');
    writeFileSync(file, `${TOKEN}\n`);
    expect(loadConfig({ ...e, OBSIGRAPH_TOKEN_FILE: file }).token).toBe(TOKEN);
  });

  // @lat: [[tests/sidecar-service#Loopback by default]]
  it('binds loopback by default and warns on an explicit wide bind', async () => {
    const f = fixture();
    expect(loadConfig(env(f)).host).toBe('127.0.0.1');
    const logs: string[] = [];
    const sc = await start(env(f, { OBSIGRAPH_HOST: '0.0.0.0' }), [], logs);
    expect((sc.server.address() as { address: string }).address).toBe('0.0.0.0');
    expect(logs.some((l) => l.includes('without TLS'))).toBe(true);
  });

  // @lat: [[tests/sidecar-service#Bounded requests]]
  it('limits body size and times out slow queries without stack traces', async () => {
    const f = fixture(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`N${i}.md`, Array.from({ length: 30 }, (_, j) => `link:: [[N${j}]]`).join('\n')])));
    const sc = await start(env(f, { OBSIGRAPH_MAX_BODY_BYTES: '200', OBSIGRAPH_QUERY_TIMEOUT_MS: '50' }));
    const big = await call(sc, '/query', { method: 'POST', body: JSON.stringify({ query: `MATCH (n) RETURN n // ${'x'.repeat(300)}` }) });
    expect(big.status).toBe(413);
    const slow = await query(sc, 'MATCH (a)-[*1..6]->(b) RETURN count(*)');
    expect(slow.status).toBe(504);
    const body = await json(slow);
    expect(body).toEqual({ error: { kind: 'timeout', message: 'Query timed out', line: 0, column: 0 } });
    expect(JSON.stringify(body)).not.toMatch(/at .*\.ts/);
  });
});
