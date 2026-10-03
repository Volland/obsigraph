import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BuiltinEngine, Graph, pathResolver, type NoteInput } from '@obsigraph/core';
import { afterEach, describe, expect, it } from 'vitest';
import { DataDir } from '../src/data-dir.js';
import { startSidecar, type Sidecar } from '../src/main.js';
import { LadybugMirror, MIRROR_FORMAT } from '../src/mirror/mirror.js';
import { graphRows } from '../src/mirror/rows.js';
import { LadybugStore, loadLadybug, MemoryStore } from '../src/mirror/store.js';

const dirs: string[] = [];
const running: Sidecar[] = [];
afterEach(async () => {
  for (const sc of running.splice(0)) await sc.stop();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tmp() {
  const root = mkdtempSync(join(tmpdir(), 'obsigraph-mirror-'));
  dirs.push(root);
  mkdirSync(join(root, 'vault'));
  mkdirSync(join(root, 'data'));
  return { root, vault: join(root, 'vault'), data: new DataDir(join(root, 'data'), join(root, 'vault')) };
}

/** A small vault held in memory: notes by path, resolved like Obsidian. */
function vault(notes: Record<string, string | [string, Record<string, unknown>]>) {
  const paths = new Set(Object.keys(notes));
  const graph = new Graph(pathResolver(() => paths));
  const put = (path: string, text: string, frontmatter: Record<string, unknown> | null = null) => {
    paths.add(path);
    graph.upsertNote({ path, text, frontmatter });
  };
  const del = (path: string) => {
    paths.delete(path);
    graph.removeNote(path);
  };
  for (const [p, v] of Object.entries(notes)) Array.isArray(v) ? put(p, v[0], v[1]) : put(p, v);
  return { graph, put, del, paths };
}

async function mirrored(graph: Graph, store = new MemoryStore()) {
  const { data } = tmp();
  const mirror = new LadybugMirror(store, data);
  await mirror.open();
  mirror.attach(graph);
  await mirror.idle();
  return { mirror, store, data };
}

/** What a perfect mirror of `graph` would contain. */
function expected(graph: Graph) {
  const rows = graphRows(graph);
  const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
  return { nodes: [...rows.nodes.values()].sort(byId), edges: [...rows.edges.values()].sort(byId) };
}

const sync = async (m: LadybugMirror, graph: Graph) => {
  m.upsert(null, graph);
  await m.idle();
};

describe('ladybug mirror', () => {
  // @lat: [[tests/mirror-sync#External edits never reach notes]]
  it('never writes notes and a rebuild restores an externally edited mirror', async () => {
    const v = vault({ 'Alice.md': 'knows:: [[Bob]]', 'Bob.md': '' });
    const { mirror, store } = await mirrored(v.graph);
    const before = JSON.stringify([...v.graph.nodes()]);
    store.nodes.get('Alice.md')!.title = 'Tampered';
    store.edges.clear();
    await mirror.rebuild();
    expect(await store.dump()).toEqual(expected(v.graph));
    expect(JSON.stringify([...v.graph.nodes()])).toBe(before);
  });

  // @lat: [[tests/mirror-sync#Delete and rebuild]]
  it('rebuilds from markdown alone after the mirror is deleted', async () => {
    const v = vault({ 'Alice.md': ['knows:: [[Bob]] {since: 2020}', { type: 'Person' }], 'Bob.md': 'likes:: [[Ghost]]' });
    const { mirror, store } = await mirrored(v.graph);
    await store.reset();
    await mirror.rebuild();
    expect(await store.dump()).toEqual(expected(v.graph));
    expect(mirror.status()).toMatchObject({ state: 'idle', nodes: 3, edges: 2 });
  });

  // @lat: [[tests/mirror-sync#Incremental equals rebuild]]
  it('matches a fresh rebuild after random edit sequences', async () => {
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) % n);
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    const types = ['knows', 'likes', 'owns'];
    for (let round = 0; round < 25; round++) {
      const v = vault({});
      const { mirror, store } = await mirrored(v.graph);
      for (let step = 0; step < 12; step++) {
        const name = names[rnd(names.length)]!;
        if (rnd(5) === 0) v.del(`${name}.md`);
        else {
          const lines = Array.from({ length: rnd(4) }, () => `${rnd(3) === 0 ? '-' : ''}${types[rnd(3)]}:: [[${names[rnd(names.length)]}]]${rnd(2) ? ` {w: ${rnd(9)}}` : ''}`);
          v.put(`${name}.md`, lines.join('\n'), rnd(2) ? { type: rnd(2) ? 'Person' : ['Person', 'Agent'] } : null);
        }
        await sync(mirror, v.graph);
      }
      const fresh = await mirrored(v.graph);
      expect(await store.dump(), `round ${round}`).toEqual(await fresh.store.dump());
      expect(await store.dump()).toEqual(expected(v.graph));
    }
  });

  // @lat: [[tests/mirror-sync#Edge removed from note]]
  it('drops an edge removed from a note', async () => {
    const v = vault({ 'Alice.md': 'knows:: [[Bob]]\nlikes:: [[Bob]]', 'Bob.md': '' });
    const { mirror, store } = await mirrored(v.graph);
    v.put('Alice.md', 'likes:: [[Bob]]');
    await sync(mirror, v.graph);
    expect((await store.dump()).edges.map((e) => e.type)).toEqual(['likes']);
  });

  // @lat: [[tests/mirror-sync#Note renamed]]
  it('moves a renamed note and its edges', async () => {
    const v = vault({ 'Alice.md': 'knows:: [[Bob]]', 'Bob.md': '', 'Carol.md': 'knows:: [[Alice]]' });
    const { mirror, store } = await mirrored(v.graph);
    v.paths.delete('Alice.md');
    v.paths.add('People/Alicia.md');
    v.graph.renameNote('Alice.md', { path: 'People/Alicia.md', text: 'knows:: [[Bob]]', frontmatter: null });
    await sync(mirror, v.graph);
    const dump = await store.dump();
    expect(dump.nodes.map((n) => n.id)).toEqual(['Alice', 'Bob.md', 'Carol.md', 'People/Alicia.md']);
    expect(dump.edges.map((e) => `${e.source}->${e.target}`).sort()).toEqual(['Carol.md->Alice', 'People/Alicia.md->Bob.md']);
    expect(dump).toEqual(expected(v.graph));
  });

  // @lat: [[tests/mirror-sync#Deleted note becomes stub]]
  it('re-points incoming edges of a deleted note to a stub', async () => {
    const v = vault({ 'Alice.md': 'knows:: [[Bob]]', 'Bob.md': '' });
    const { mirror, store } = await mirrored(v.graph);
    v.del('Bob.md');
    await sync(mirror, v.graph);
    const dump = await store.dump();
    expect(dump.nodes.find((n) => n.id === 'Bob')).toMatchObject({ stub: true, path: null });
    expect(dump.edges).toEqual([expect.objectContaining({ source: 'Alice.md', target: 'Bob' })]);
  });

  // @lat: [[tests/mirror-sync#Signed edge with properties]]
  it('keeps type, sign, id, heading and properties of signed edges', async () => {
    const v = vault({ 'Alice.md': '## Trust\n-distrusts:: [[Eve]] {id: "a-e", since: 2019, why: "phishing"}', 'Eve.md': '' });
    const { store } = await mirrored(v.graph);
    expect((await store.dump()).edges[0]).toMatchObject({ id: 'a-e', type: 'distrusts', sign: -1, heading: 'Trust' });
    expect(JSON.parse((await store.dump()).edges[0]!.props)).toEqual({ id: 'a-e', since: 2019, why: 'phishing' });
  });

  // @lat: [[tests/mirror-sync#Multiple labels kept]]
  it('stores every label of a multi-label node', async () => {
    const v = vault({ 'Bob.md': ['', { type: ['Person', 'Employee'], age: 40 }] });
    const { store } = await mirrored(v.graph);
    const bob = (await store.dump()).nodes[0]!;
    expect(bob.labels).toEqual(['Person', 'Employee']);
    expect(JSON.parse(bob.props)).toMatchObject({ age: 40, type: ['Person', 'Employee'] });
  });

  // @lat: [[tests/mirror-sync#Parallel edges kept]]
  it('keeps parallel edges between the same nodes as separate rows', async () => {
    const v = vault({ 'Alice.md': 'knows:: [[Bob]] {since: 2020}\nknows:: [[Bob]] {since: 2023}', 'Bob.md': '' });
    const { store } = await mirrored(v.graph);
    expect((await store.dump()).edges.map((e) => e.id)).toEqual(['Alice.md#knows#Bob.md#0', 'Alice.md#knows#Bob.md#1']);
  });

  // @lat: [[tests/mirror-sync#Format change rebuilds]]
  it('rebuilds when the stored format version differs', async () => {
    const v = vault({ 'Alice.md': 'knows:: [[Bob]]', 'Bob.md': '' });
    const store = new MemoryStore();
    const { data } = tmp();
    await data.writeJson('ladybug/manifest.json', { format: MIRROR_FORMAT - 1, state: 'complete' });
    store.nodes.set('Stale.md', { id: 'Stale.md', labels: [], title: 'Stale', path: 'Stale.md', stub: false, props: '{}', cols: {}, sig: 'x' });
    const m = new LadybugMirror(store, data);
    await m.open();
    m.attach(v.graph);
    await m.idle();
    expect(m.status().rebuilds).toBe(1);
    expect(await store.dump()).toEqual(expected(v.graph));
  });

  // @lat: [[tests/mirror-sync#Interrupted sync rebuilds]]
  it('rebuilds after an interrupted or failed sync', async () => {
    const v = vault({ 'Alice.md': 'knows:: [[Bob]]', 'Bob.md': '' });
    const store = new MemoryStore();
    const { mirror, data } = await mirrored(v.graph, store);
    v.put('Alice.md', 'likes:: [[Bob]]');
    store.failNextApply = new Error('disk full');
    await sync(mirror, v.graph);
    expect(mirror.status()).toMatchObject({ state: 'failed', message: 'disk full' });
    expect(await data.readJson('ladybug/manifest.json')).toEqual({ format: MIRROR_FORMAT, state: 'in-progress' });
    const reopened = new LadybugMirror(store, data);
    await reopened.open();
    reopened.attach(v.graph);
    await reopened.idle();
    expect(reopened.status()).toMatchObject({ state: 'idle', rebuilds: 1 });
    expect(await store.dump()).toEqual(expected(v.graph));
  });

  // @lat: [[tests/mirror-sync#Disabled by configuration]]
  it('creates no mirror when disabled and keeps queries working', async () => {
    const t = tmp();
    writeFileSync(join(t.vault, 'Alice.md'), 'knows:: [[Bob]]');
    const sc = await startSidecar({ OBSIGRAPH_VAULT: t.vault, OBSIGRAPH_DATA: t.data.root, OBSIGRAPH_TOKEN: 'x', OBSIGRAPH_PORT: '0', OBSIGRAPH_VECTORS: '0', OBSIGRAPH_LADYBUG: '0' }, { log: () => {} });
    running.push(sc);
    expect(sc.mirror).toBeNull();
    expect(() => t.data.path('ladybug')).not.toThrow();
    const { existsSync } = await import('node:fs');
    expect(existsSync(t.data.path('ladybug'))).toBe(false);
    expect(new BuiltinEngine(sc.sync.graph).run('MATCH (a)-->(b) RETURN b.title').rows).toEqual([['Bob']]);
  });

  // @lat: [[tests/mirror-sync#Not installed reported]]
  it('reports the mirror as unavailable with the reason when the store cannot load', async () => {
    const t = tmp();
    writeFileSync(join(t.vault, 'Alice.md'), 'knows:: [[Bob]]');
    const sc = await startSidecar(
      { OBSIGRAPH_VAULT: t.vault, OBSIGRAPH_DATA: t.data.root, OBSIGRAPH_TOKEN: 'x', OBSIGRAPH_PORT: '0', OBSIGRAPH_VECTORS: '0' },
      { log: () => {}, loadLadybug: async () => ({ error: "Cannot find module '@ladybugdb/core'" }) },
    );
    running.push(sc);
    expect(sc.mirror).toBeNull();
    const status = (await (await fetch(`http://127.0.0.1:${sc.port}/status`, { headers: { authorization: 'Bearer x' } })).json()) as { mirror: unknown };
    expect(status.mirror).toEqual({ state: 'unavailable', message: "LadybugDB unavailable: Cannot find module '@ladybugdb/core'" });
    const q = await fetch(`http://127.0.0.1:${sc.port}/query`, { method: 'POST', headers: { authorization: 'Bearer x' }, body: JSON.stringify({ query: 'MATCH (a)-->(b) RETURN b.title' }) });
    expect(((await q.json()) as { rows: unknown }).rows).toEqual([['Bob']]);
  });

  // @lat: [[tests/mirror-sync#Large build does not block queries]]
  it('syncs in the background so queries answer during a slow build', async () => {
    const notes = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`N${i}.md`, `link:: [[N${(i + 1) % 200}]]`]));
    const v = vault(notes);
    const store = new MemoryStore();
    store.applyDelayMs = 150;
    const { data } = tmp();
    const m = new LadybugMirror(store, data);
    await m.open();
    m.attach(v.graph);
    await new Promise((r) => setTimeout(r, 20));
    expect(m.status().state).toBe('syncing');
    expect(new BuiltinEngine(v.graph).run('MATCH (n) RETURN count(n)').rows).toEqual([[200]]);
    await m.idle();
    expect(m.status()).toMatchObject({ state: 'idle', nodes: 200, edges: 200 });
  });

  // @lat: [[tests/mirror-sync#Real LadybugDB round trip]]
  it('mirrors into a real LadybugDB and answers Cypher there', async () => {
    const loaded = await loadLadybug();
    if (!('lbug' in loaded)) return;
    const v = vault({
      'Alice.md': ['knows:: [[Bob]] {since: 2020}\n-distrusts:: [[Eve]]\nnode:: [[Bob]]', { type: 'Person' }],
      'Bob.md': ['knows:: [[Ghost]]', { type: ['Person', 'Employee'] }],
      'Eve.md': '',
    });
    const t = tmp();
    const store = new LadybugStore(loaded.lbug, t.data);
    await store.open();
    const m = new LadybugMirror(store, t.data);
    await m.open();
    m.attach(v.graph);
    await m.idle();
    expect(m.status().state).toBe('idle');
    expect(await store.dump()).toEqual(expected(v.graph));
    v.put('Alice.md', 'knows:: [[Bob]] {since: 2021}', { type: 'Person' });
    await sync(m, v.graph);
    expect(await store.dump()).toEqual(expected(v.graph));
    const r = await store.connection().query("MATCH (a:Node)-[k:knows]->(b:Node) WHERE list_contains(a.labels, 'Person') RETURN a.title AS src, b.title AS dst ORDER BY src");
    expect(await (Array.isArray(r) ? r[0]! : r).getAll()).toEqual([{ src: 'Alice', dst: 'Bob' }, { src: 'Bob', dst: 'Ghost' }]);
    await store.close();
    // Reopen: state survives, no rebuild.
    const store2 = new LadybugStore(loaded.lbug, t.data);
    await store2.open();
    const m2 = new LadybugMirror(store2, t.data);
    await m2.open();
    expect(m2.status().rebuilds).toBe(0);
    m2.attach(v.graph);
    await m2.idle();
    expect(await store2.dump()).toEqual(expected(v.graph));
    await store2.close();
  });
});
