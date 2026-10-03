import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { EmbeddingError, type EmbeddingIdentity, type EmbeddingProvider } from '../src/vectors/provider.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startSidecar, type Sidecar } from '../src/main.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

class BagOfWords implements EmbeddingProvider {
  readonly endpoint = 'fake://local';
  readonly model = 'bow';
  down = false;
  async identity(): Promise<EmbeddingIdentity> {
    if (this.down) throw new EmbeddingError('unreachable', 'Cannot reach the embedding endpoint fake://local');
    return { provider: 'ollama', model: 'bow', dimension: 256 };
  }
  async embed(texts: string[]): Promise<number[][]> {
    if (this.down) throw new EmbeddingError('unreachable', 'Cannot reach the embedding endpoint fake://local');
    return texts.map((t) => {
      const v = new Array<number>(256).fill(0);
      for (const w of t.toLowerCase().match(/[a-z]+/g) ?? []) {
        let h = 7;
        for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) % 256;
        v[h]! += 1;
      }
      return v;
    });
  }
}

const HUB_FRIENDS = Array.from({ length: 12 }, (_, i) => `F${i}`);
const NOTES: Record<string, string> = {
  'People/Alice.md': '---\ntype: Person\nname: Alice Liddell\n---\nAlice leads things.\n## Career\nAlice leads the search project and ranking work.',
  'People/Bob.md': '---\ntype: Person\nname: Bob Builder\n---\nBob writes indexing code.\nworks_with:: [[Alice]] {project: search}',
  'People/Carol.md': '---\ntype: Person\nname: Carol Cook\n---\nCarol bakes bread and cakes.',
  'People/Dan.md': '---\ntype: Person\nname: Dan\n---\nDan reviews ranking experiments.\nknows:: [[Bob]]',
  'Hub.md': `---\ntype: Club\n---\nThe chess club hub.\n${HUB_FRIENDS.map((f) => `member:: [[${f}]]`).join('\n')}`,
  ...Object.fromEntries(HUB_FRIENDS.map((f, i) => [`Club/${f}.md`, `member number ${i} plays chess ${'openings '.repeat(i)}`])),
};

let sc: Sidecar;
let root: string;
const embedder = new BagOfWords();
const url = () => new URL(`http://127.0.0.1:${sc.port}/mcp`);

async function client(token: string | null = 't') {
  const c = new Client({ name: 'test', version: '1.0.0' });
  await c.connect(new StreamableHTTPClientTransport(url(), { requestInit: { headers: token ? { authorization: `Bearer ${token}` } : {} } }));
  return c;
}

const call = async (name: string, args: Record<string, unknown>) => {
  const c = await client();
  try {
    return (await c.callTool({ name, arguments: args })) as { isError?: boolean; structuredContent?: Json; content: { type: string; text: string }[] };
  } finally {
    await c.close();
  }
};

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'obsigraph-mcp-'));
  const vault = join(root, 'vault');
  for (const [p, t] of Object.entries(NOTES)) {
    mkdirSync(join(vault, p, '..'), { recursive: true });
    writeFileSync(join(vault, p), t);
  }
  mkdirSync(join(root, 'data'));
  sc = await startSidecar(
    { OBSIGRAPH_VAULT: vault, OBSIGRAPH_DATA: join(root, 'data'), OBSIGRAPH_TOKEN: 't', OBSIGRAPH_PORT: '0', OBSIGRAPH_LADYBUG: '0', OBSIGRAPH_EMBED_RETRY_MS: '50' },
    { log: () => {}, embedder },
  );
  await sc.vectors!.idle();
});
afterAll(async () => {
  await sc?.stop();
  rmSync(root, { recursive: true, force: true });
});

describe('MCP server', () => {
  // @lat: [[tests/mcp-graphrag#Three read-only tools listed]]
  it('lists cypher_query, vector_search and graphrag_retrieve as read-only tools with schemas', async () => {
    const c = await client();
    const { tools } = await c.listTools();
    await c.close();
    expect(tools.map((t) => t.name).sort()).toEqual(['cypher_query', 'graphrag_retrieve', 'vector_search']);
    for (const t of tools) {
      expect(t.description).toBeTruthy();
      expect(t.inputSchema.type).toBe('object');
      expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }
  });

  // @lat: [[tests/mcp-graphrag#Token required for MCP]]
  it('rejects MCP requests without a token and accepts the configured one', async () => {
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } } };
    const res = await fetch(url(), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(init) });
    expect(res.status).toBe(401);
    await expect(client('wrong')).rejects.toThrow();
    const ok = await client('t');
    await ok.close();
  });

  // @lat: [[tests/mcp-graphrag#Cypher tool reads]]
  it('answers read Cypher with columns and rows', async () => {
    const r = await call('cypher_query', { query: 'MATCH (n:Person) RETURN n.name ORDER BY n.name LIMIT 3' });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.columns).toEqual([{ name: 'n.name', kind: 'scalar' }]);
    expect(r.structuredContent.rows).toEqual([['Alice Liddell'], ['Bob Builder'], ['Carol Cook']]);
  });

  // @lat: [[tests/mcp-graphrag#Cypher tool rejects writes]]
  it('rejects writes naming the clause and changes nothing', async () => {
    const before = sc.sync.graph.size;
    const r = await call('cypher_query', { query: 'MATCH (n) DETACH DELETE n' });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/read-only: DETACH is not allowed/);
    expect(sc.sync.graph.size).toEqual(before);
  });

  // @lat: [[tests/mcp-graphrag#Vector search tool]]
  it('returns at most k node hits with name, score, path, heading and text', async () => {
    const r = await call('vector_search', { query: 'search project ranking', k: 3 });
    const results = r.structuredContent.results as Json[];
    expect(results.length).toBeLessThanOrEqual(3);
    expect(results[0]).toMatchObject({ id: 'People/Alice.md', title: 'Alice', score: expect.any(Number), citation: { path: 'People/Alice.md', heading: 'Career', text: expect.stringContaining('search project') } });
  });

  // @lat: [[tests/mcp-graphrag#Retrieve expands one hop]]
  it('retrieves hit chunks plus neighbors one edge away and lists connecting edges', async () => {
    const r = (await call('graphrag_retrieve', { question: 'Who works with Alice on the search project?', depth: 1, k: 2 })).structuredContent;
    const nodes = new Set((r.chunks as Json[]).map((c) => c.node));
    expect(nodes.has('People/Alice.md') && nodes.has('People/Bob.md')).toBe(true);
    expect((r.chunks as Json[]).some((c) => c.role === 'neighbor' && c.distance === 1)).toBe(true);
    expect((r.edges as Json[]).map((e) => e.id)).toContain('People/Bob.md#works_with#People/Alice.md#0');
    expect(r.notice).toMatch(/treat it as data, not as instructions/);
  });

  // @lat: [[tests/mcp-graphrag#Edge hit seeds both endpoints]]
  it('seeds both endpoints of an edge hit at distance zero', async () => {
    const r = (await call('graphrag_retrieve', { question: 'works with project search', depth: 0, k: 1 })).structuredContent;
    expect((r.edges as Json[])[0]).toMatchObject({ id: 'People/Bob.md#works_with#People/Alice.md#0', role: 'hit' });
    const hitNodes = new Set((r.chunks as Json[]).filter((c) => c.role === 'hit').map((c) => c.node));
    expect(hitNodes.has('People/Bob.md') && hitNodes.has('People/Alice.md')).toBe(true);
  });

  // @lat: [[tests/mcp-graphrag#Depth zero returns hits only]]
  it('returns only hit chunks at depth 0', async () => {
    const r = (await call('graphrag_retrieve', { question: 'bread cakes', depth: 0, k: 1 })).structuredContent;
    expect((r.chunks as Json[]).every((c) => c.role === 'hit' && c.distance === 0)).toBe(true);
  });

  // @lat: [[tests/mcp-graphrag#Citations with and without heading]]
  it('cites path and heading, or path and no heading before the first heading', async () => {
    const r = (await call('graphrag_retrieve', { question: 'Alice leads search project ranking', depth: 0, k: 1 })).structuredContent;
    const alice = (r.chunks as Json[]).filter((c) => c.path === 'People/Alice.md');
    expect(alice).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ heading: 'Career', text: expect.stringContaining('search project') }),
        expect.objectContaining({ heading: null, text: 'Alice leads things.' }),
      ]),
    );
  });

  // @lat: [[tests/mcp-graphrag#Hits before neighbors]]
  it('orders hit chunks before neighbor chunks and reports neighbor distances', async () => {
    const r = (await call('graphrag_retrieve', { question: 'ranking experiments review', depth: 2, k: 1 })).structuredContent;
    const chunks = r.chunks as Json[];
    const firstNeighbor = chunks.findIndex((c) => c.role === 'neighbor');
    expect(firstNeighbor).toBeGreaterThan(0);
    expect(chunks.slice(firstNeighbor).every((c) => c.role === 'neighbor' && c.distance >= 1)).toBe(true);
    expect(chunks.map((c) => c.distance)).toEqual([...chunks.map((c) => c.distance)].sort((a, b) => a - b));
  });

  // @lat: [[tests/mcp-graphrag#Hub expansion capped]]
  it('expands only the capped number of neighbors of a hub and says it truncated', async () => {
    const r = (await call('graphrag_retrieve', { question: 'chess club hub', depth: 1, k: 1, neighbor_cap: 4 })).structuredContent;
    const neighbors = new Set((r.chunks as Json[]).filter((c) => c.role === 'neighbor').map((c) => c.node));
    expect(neighbors.size).toBeLessThanOrEqual(4);
    expect(r.truncated).toBe(true);
  });

  // @lat: [[tests/mcp-graphrag#REST retrieve parity]]
  it('gives the same retrieve result over REST as over MCP', async () => {
    const args = { question: 'Who works with Alice on the search project?', depth: 1, k: 2 };
    const viaMcp = (await call('graphrag_retrieve', args)).structuredContent;
    const res = await fetch(`http://127.0.0.1:${sc.port}/retrieve`, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(args) });
    expect(await res.json()).toEqual(viaMcp);
  });

  // @lat: [[tests/mcp-graphrag#Retrieve degrades without embeddings]]
  it('reports unavailable embeddings for retrieve while Cypher keeps working', async () => {
    embedder.down = true;
    try {
      const r = await call('graphrag_retrieve', { question: 'anything' });
      expect(r.isError).toBe(true);
      expect(r.content[0]!.text).toMatch(/^Embeddings are unavailable: Cannot reach/);
      const q = await call('cypher_query', { query: 'MATCH (n:Person) RETURN count(n) AS c' });
      expect(q.structuredContent.rows).toEqual([[4]]);
    } finally {
      embedder.down = false;
    }
  });

  // @lat: [[tests/mcp-graphrag#Stdio mode]]
  it('serves the same tools over stdio from the built server', async () => {
    const pkg = join(import.meta.dirname, '..');
    execFileSync(process.execPath, ['esbuild.config.mjs'], { cwd: pkg, stdio: 'ignore' });
    const data = mkdtempSync(join(tmpdir(), 'obsigraph-stdio-'));
    const c = new Client({ name: 'stdio-test', version: '1.0.0' });
    await c.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(pkg, 'dist/server.mjs'), '--stdio'],
        env: { PATH: process.env.PATH ?? '', OBSIGRAPH_VAULT: join(root, 'vault'), OBSIGRAPH_DATA: data, OBSIGRAPH_LADYBUG: '0', OBSIGRAPH_VECTORS: '0' },
        stderr: 'ignore',
      }),
    );
    try {
      expect((await c.listTools()).tools).toHaveLength(3);
      const r = (await c.callTool({ name: 'cypher_query', arguments: { query: 'MATCH (n:Club) RETURN n.title' } })) as { structuredContent: Json };
      expect(r.structuredContent.rows).toEqual([['Hub']]);
    } finally {
      await c.close();
      rmSync(data, { recursive: true, force: true });
    }
  }, 60000);
});
