import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EmbeddingError, OllamaProvider, type EmbeddingIdentity, type EmbeddingProvider } from '@obsigraph/core';
import { afterEach, describe, expect, it } from 'vitest';
import { startSidecar, type Sidecar } from '../src/main.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Deterministic bag-of-words embedding that counts what it embeds. */
class FakeProvider implements EmbeddingProvider {
  readonly endpoint = 'fake://local';
  embedded: string[] = [];
  down = false;
  constructor(
    readonly model = 'fake-embed',
    private readonly dim = 128,
  ) {}
  async identity(): Promise<EmbeddingIdentity> {
    if (this.down) throw new EmbeddingError('unreachable', 'Cannot reach the embedding endpoint fake://local');
    return { provider: 'ollama', model: this.model, dimension: this.dim };
  }
  async embed(texts: string[]): Promise<number[][]> {
    if (this.down) throw new EmbeddingError('unreachable', 'Cannot reach the embedding endpoint fake://local');
    this.embedded.push(...texts);
    return texts.map((t) => {
      const v = new Array<number>(this.dim).fill(0);
      for (const w of t.toLowerCase().match(/[a-z]+/g) ?? []) {
        let h = 0;
        for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) % this.dim;
        v[h]! += 1;
      }
      return v;
    });
  }
}

const running: Sidecar[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const sc of running.splice(0)) await sc.stop();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const ML = 'machine learning models neural networks training';
function vault(extra: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'obsigraph-vec-'));
  dirs.push(root);
  const v = join(root, 'vault');
  mkdirSync(join(v, 'People'), { recursive: true });
  mkdirSync(join(root, 'data'));
  const notes: Record<string, string> = {
    'People/Alice.md': `---\ntype: Person\n---\n## Research\n${ML} deep learning\n## Hobbies\ngardening and chess\nknows:: [[Bob]] {label: "met at a conference in Lisbon"}\nworks_at:: [[Acme]]`,
    'People/Bob.md': `---\ntype: Person\n---\n## Work\n${ML} transformers\nworks_at:: [[Initech]]`,
    'People/Carol.md': `---\ntype: Person\n---\ncooking recipes and baking bread\nworks_at:: [[Acme]]`,
    'Acme.md': '---\ntype: Company\n---\nwe build robots',
    'Initech.md': '---\ntype: Company\n---\nwe build software',
    'ML.md': `---\ntype: Topic\n---\n${ML}`,
    ...extra,
  };
  for (const [p, t] of Object.entries(notes)) writeFileSync(join(v, p), t);
  return { root, vault: v, data: join(root, 'data') };
}

async function start(f: { vault: string; data: string }, embedder: EmbeddingProvider, env: Record<string, string> = {}) {
  const sc = await startSidecar(
    { OBSIGRAPH_VAULT: f.vault, OBSIGRAPH_DATA: f.data, OBSIGRAPH_TOKEN: 't', OBSIGRAPH_PORT: '0', OBSIGRAPH_LADYBUG: '0', OBSIGRAPH_DEBOUNCE_MS: '30', OBSIGRAPH_EMBED_RETRY_MS: '50', ...env },
    { log: () => {}, embedder },
  );
  running.push(sc);
  await sc.vectors!.idle();
  return sc;
}

const api = async (sc: Sidecar, path: string, body?: unknown): Promise<{ status: number; body: Json }> => {
  const res = await fetch(`http://127.0.0.1:${sc.port}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer t' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

async function until(cond: () => boolean | Promise<boolean>, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('condition not met in time');
}

/** Wait until the sidecar has processed file events and the index has settled. */
async function settle(sc: Sidecar, cond: () => boolean | Promise<boolean>) {
  await until(async () => {
    await sc.sync.idle();
    await sc.vectors!.idle();
    return cond();
  });
}

describe('vector index', { timeout: 20000 }, () => {
  // @lat: [[tests/vector-index#Chunks and edges indexed]]
  it('indexes chunk vectors per node and one sentence vector per edge', async () => {
    const f = vault();
    const sc = await start(f, new FakeProvider());
    const st = sc.vectors!.status();
    expect(st).toMatchObject({ state: 'ready', pending: 0 });
    // Alice: two sections -> two chunks, two edges -> two sentences; four edges in all.
    const alice = await api(sc, '/search', { query: 'gardening chess', k: 1 });
    expect(alice.body.results[0]).toMatchObject({ id: 'People/Alice.md', citation: { heading: 'Hobbies' } });
    expect(st.chunks).toBe(7);
    expect(st.edges).toBe(4);
  });

  // @lat: [[tests/vector-index#Model identity recorded]]
  it('records the model identity with the index', async () => {
    const f = vault();
    const sc = await start(f, new FakeProvider('nomic-embed-text', 768));
    const status = (await api(sc, '/status')).body;
    expect(status.embeddingModel).toEqual({ provider: 'ollama', model: 'nomic-embed-text', dimension: 768 });
    expect(status.vectors).toMatchObject({ state: 'ready', chunks: 7, edges: 4 });
  });

  // @lat: [[tests/vector-index#Model change blocks writes]]
  it('blocks writes on a model change, keeps searching the stale index, and rebuilds on request', async () => {
    const f = vault();
    await (await start(f, new FakeProvider('model-a'))).stop();
    running.pop();
    const b = new FakeProvider('model-b');
    const sc = await start(f, b);
    expect(sc.vectors!.status()).toMatchObject({ state: 'mismatch' });
    writeFileSync(join(f.vault, 'ML.md'), '---\ntype: Topic\n---\nquantum computing');
    await settle(sc, () => sc.sync.graph.node('ML.md') !== undefined);
    await new Promise((r) => setTimeout(r, 100));
    expect(b.embedded.filter((t) => t.includes('quantum'))).toEqual([]);
    const stale = await api(sc, '/search', { query: 'machine learning', k: 2 });
    expect(stale.body).toMatchObject({ stale: true });
    expect(stale.body.notices[0]).toMatch(/stale index/);
    const status = (await api(sc, '/status')).body;
    expect(status.vectors.message).toMatch(/model-a .*model-b.*rebuild/);

    const rebuilt = await api(sc, '/vectors/rebuild', {});
    expect(rebuilt.body).toMatchObject({ state: 'ready', identity: { model: 'model-b' } });
    expect(b.embedded.some((t) => t.includes('quantum'))).toBe(true);
  });

  // @lat: [[tests/vector-index#Only edited chunk re-embedded]]
  it('re-embeds only the edited chunk of a five-chunk note', async () => {
    const sections = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map((w) => `## ${w}\n${w} text here`);
    const f = vault({ 'Five.md': sections.join('\n') });
    const p = new FakeProvider();
    const sc = await start(f, p);
    p.embedded = [];
    writeFileSync(join(f.vault, 'Five.md'), sections.join('\n').replace('gamma text here', 'gamma text changed'));
    await settle(sc, () => p.embedded.length > 0);
    expect(p.embedded).toEqual([expect.stringContaining('gamma text changed')]);
  });

  // @lat: [[tests/vector-index#Removed edge and note dropped]]
  it('drops the sentence of a removed edge and every vector of a deleted note', async () => {
    const f = vault();
    const sc = await start(f, new FakeProvider());
    writeFileSync(join(f.vault, 'People/Carol.md'), '---\ntype: Person\n---\ncooking recipes and baking bread');
    await settle(sc, () => sc.vectors!.status().edges === 3);
    rmSync(join(f.vault, 'People/Bob.md'));
    await settle(sc, () => sc.vectors!.status().chunks === 6);
    const files = readdirSync(join(f.data, 'vectors/notes'));
    expect(files).toHaveLength(5);
    expect((await api(sc, '/search', { query: 'transformers', k: 10 })).body.results.map((r: Json) => r.id)).not.toContain('People/Bob.md');
  });

  // @lat: [[tests/vector-index#Rename reuses vectors]]
  it('re-attributes vectors on a folder move without re-embedding unchanged text', async () => {
    const f = vault();
    const p = new FakeProvider();
    const sc = await start(f, p);
    p.embedded = [];
    mkdirSync(join(f.vault, 'Archive'));
    renameSync(join(f.vault, 'People/Carol.md'), join(f.vault, 'Archive/Carol.md'));
    await settle(sc, async () => (await api(sc, '/search', { query: 'baking bread', k: 1 })).body.results[0]?.id === 'Archive/Carol.md');
    // Only search queries were embedded; no chunk text (which starts with the title) was.
    expect(p.embedded.filter((t) => t.startsWith('Carol'))).toEqual([]);
  });

  // @lat: [[tests/vector-index#Top nodes with citations]]
  it('returns at most k nodes by descending score with their best chunk citation', async () => {
    const f = vault();
    const sc = await start(f, new FakeProvider());
    const r = await api(sc, '/search', { query: 'machine learning neural networks', k: 5 });
    expect(r.status).toBe(200);
    const results = r.body.results as Json[];
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results.map((x) => x.score)).toEqual([...results.map((x) => x.score)].sort((a, b) => b - a));
    expect(results[0].citation).toMatchObject({ path: expect.any(String), text: expect.stringContaining('machine learning') });
    expect(results.slice(0, 3).map((x) => x.id).sort()).toEqual(['ML.md', 'People/Alice.md', 'People/Bob.md']);
  });

  // @lat: [[tests/vector-index#Edge search returns sentences]]
  it('finds edges by the meaning of their sentence', async () => {
    const f = vault();
    const sc = await start(f, new FakeProvider());
    const r = await api(sc, '/search', { query: 'who did Alice meet at a conference', target: 'edges', k: 3 });
    expect(r.body.results[0]).toMatchObject({
      id: 'People/Alice.md#knows#People/Bob.md#0',
      sentence: 'Alice (Person) knows Bob (Person) - met at a conference in Lisbon',
      citation: { path: 'People/Alice.md' },
    });
  });

  // @lat: [[tests/vector-index#Search then traverse]]
  it('feeds vector hits into a Cypher query as $hits', async () => {
    const f = vault();
    const sc = await start(f, new FakeProvider());
    const r = await api(sc, '/search', {
      query: 'machine learning',
      k: 3,
      types: ['Person'],
      then: 'MATCH (p)-[:works_at]->(c) WHERE id(p) IN $hits RETURN DISTINCT c.title AS company ORDER BY company',
    });
    expect(r.body.results.every((x: Json) => x.labels.includes('Person'))).toBe(true);
    expect(r.body.then.rows).toEqual([['Acme'], ['Initech']]);
  });

  // @lat: [[tests/vector-index#Type filter]]
  it('restricts node search to a type', async () => {
    const f = vault();
    const sc = await start(f, new FakeProvider());
    const r = await api(sc, '/search', { query: 'machine learning', k: 10, types: ['Topic'] });
    expect(r.body.results.map((x: Json) => x.id)).toEqual(['ML.md']);
  });

  // @lat: [[tests/vector-index#Rebuild gives same results]]
  it('gives the same results after the index storage is deleted and rebuilt', async () => {
    const f = vault();
    const sc = await start(f, new FakeProvider());
    const before = (await api(sc, '/search', { query: 'machine learning robots', k: 5 })).body.results;
    await sc.stop();
    running.pop();
    rmSync(join(f.data, 'vectors'), { recursive: true, force: true });
    const sc2 = await start(f, new FakeProvider());
    expect((await api(sc2, '/search', { query: 'machine learning robots', k: 5 })).body.results).toEqual(before);
  });

  // @lat: [[tests/vector-index#Provider down keeps old vectors]]
  it('keeps old vectors searchable while the provider is down and catches up later', async () => {
    const f = vault();
    const p = new FakeProvider();
    const sc = await start(f, p);
    p.down = true;
    writeFileSync(join(f.vault, 'ML.md'), '---\ntype: Topic\n---\nquantum computing qubits');
    await settle(sc, () => sc.vectors!.status().state === 'degraded');
    expect(sc.vectors!.status().pending).toBeGreaterThan(0);
    const status = (await api(sc, '/status')).body;
    expect(status.vectors).toMatchObject({ state: 'degraded', message: expect.stringMatching(/Cannot reach/) });
    const search = await api(sc, '/search', { query: 'machine', k: 1 });
    expect(search.status).toBe(503);
    p.down = false;
    await until(async () => (await api(sc, '/search', { query: 'quantum qubits', k: 1 })).body.results?.[0]?.id === 'ML.md');
    await until(() => sc.vectors!.status().state === 'ready' && sc.vectors!.status().pending === 0);
  });

  // @lat: [[tests/vector-index#Provider unreachable at start]]
  it('starts, serves graph queries and reports degraded when the provider is down at start', async () => {
    const f = vault();
    const p = new FakeProvider();
    p.down = true;
    const sc = await start(f, p);
    expect((await api(sc, '/status')).body.vectors).toMatchObject({ state: 'degraded' });
    const q = await api(sc, '/query', { query: 'MATCH (c:Company) RETURN count(c) AS n' });
    expect(q.body.rows).toEqual([[2]]);
    p.down = false;
    await until(() => sc.vectors!.status().state === 'ready');
  });

  // @lat: [[tests/vector-index#Search request validated]]
  it('validates search requests and reports a disabled index', async () => {
    const f = vault();
    const sc = await start(f, new FakeProvider());
    expect((await api(sc, '/search', { query: '' })).status).toBe(400);
    expect((await api(sc, '/search', { query: 'x', k: 0 })).status).toBe(400);
    expect((await api(sc, '/search', { query: 'x', target: 'chunks' })).status).toBe(400);
    const g = vault();
    const off = await startSidecar({ OBSIGRAPH_VAULT: g.vault, OBSIGRAPH_DATA: g.data, OBSIGRAPH_TOKEN: 't', OBSIGRAPH_PORT: '0', OBSIGRAPH_LADYBUG: '0', OBSIGRAPH_VECTORS: '0' }, { log: () => {} });
    running.push(off);
    expect((await api(off, '/search', { query: 'x' })).status).toBe(503);
    expect(existsSync(join(g.data, 'vectors'))).toBe(false);
  });

  // @lat: [[tests/vector-index#Real Ollama semantic search]]
  it('finds semantically related notes and edges with the real local Ollama', async () => {
    const probe = await new OllamaProvider().embed(['ping']).catch(() => null);
    if (!probe) return;
    const f = vault();
    const sc = await start(f, new OllamaProvider());
    expect(sc.vectors!.status()).toMatchObject({ state: 'ready', identity: { model: 'nomic-embed-text', dimension: 768 } });
    const nodes = await api(sc, '/search', { query: 'artificial intelligence research', k: 3, types: ['Person', 'Topic'] });
    expect(nodes.body.results.map((x: Json) => x.id)).not.toContain('People/Carol.md');
    const edges = await api(sc, '/search', { query: 'who did Alice meet at an academic event', target: 'edges', k: 1 });
    expect(edges.body.results[0].id).toBe('People/Alice.md#knows#People/Bob.md#0');
  }, 60000);
});
