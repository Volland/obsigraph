import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BuiltinEngine, Graph, NodeRef, pathResolver, RelRef, resultToJson } from '@obsigraph/core';
import { describe, expect, it } from 'vitest';
import { startSidecar } from '../../sidecar/src/main.js';
import { loadLadybug } from '../../sidecar/src/mirror/store.js';
import { parseBlock } from '../src/query/block';
import { planRender } from '../src/query/plan';
import { runRemote, type Fetcher } from '../src/query/remote';

const nodeFetch: Fetcher = async (req) => {
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const fake = (status: number, json: unknown): Fetcher => async () => ({ status, json });
const cfg = { url: 'http://sidecar:8765/', token: 't' };

describe('ladybug backend in the plugin', () => {
  // @lat: [[tests/ladybug-backend#Backend selection]]
  it('picks the backend from the header, else the default, and rejects unknown values', () => {
    expect(parseBlock('backend: ladybug\n\nMATCH (n) RETURN n').options.backend).toBe('ladybug');
    expect(parseBlock('MATCH (n) RETURN n').options.backend).toBeNull();
    const bad = parseBlock('backend: neo4j\nMATCH (n) RETURN n');
    expect(bad.errors).toEqual([{ line: 0, message: "Invalid backend 'neo4j' (expected builtin or ladybug)" }]);
  });

  // @lat: [[tests/ladybug-backend#Sidecar not configured or unreachable]]
  it('explains a missing or unreachable sidecar and a rejected token', async () => {
    expect(await runRemote(fake(200, {}), { url: '', token: '' }, 'MATCH (n) RETURN n')).toMatchObject({ kind: 'error', message: expect.stringMatching(/Set the sidecar URL and token/) });
    const down: Fetcher = async () => {
      throw new Error('connect ECONNREFUSED');
    };
    expect(await runRemote(down, cfg, 'MATCH (n) RETURN n')).toMatchObject({ kind: 'error', message: 'Cannot reach the Typed Graph sidecar at http://sidecar:8765: connect ECONNREFUSED' });
    expect(await runRemote(fake(401, { error: {} }), cfg, 'q')).toMatchObject({ message: expect.stringMatching(/rejected the token/) });
  });

  // @lat: [[tests/ladybug-backend#Ladybug unavailable on sidecar]]
  it('says how to enable Ladybug when the sidecar reports it unavailable', async () => {
    const r = await runRemote(fake(503, { error: { kind: 'unavailable', message: "LadybugDB unavailable: Cannot find module '@ladybugdb/core'" } }), cfg, 'q');
    expect(r).toMatchObject({ kind: 'error', message: expect.stringMatching(/not available on the sidecar: .*Install @ladybugdb\/core/) });
  });

  // @lat: [[tests/ladybug-backend#Mirror rebuilding retries]]
  it('asks to retry while the mirror is still building', async () => {
    const r = await runRemote(fake(503, { error: { kind: 'not_ready', message: 'The Ladybug mirror is still building; try again shortly.' } }), cfg, 'q');
    expect(r).toEqual({ kind: 'retry', message: 'The Ladybug mirror is still building; try again shortly.', afterMs: 3000 });
  });

  // @lat: [[tests/ladybug-backend#Remote errors keep position]]
  it('passes query errors through with their position', async () => {
    const r = await runRemote(fake(400, { error: { kind: 'syntax', message: "Expected ')' but found 'RETURN'", line: 1, column: 10 } }), cfg, 'MATCH (a RETURN a');
    expect(r).toEqual({ kind: 'error', message: "Expected ')' but found 'RETURN'", line: 1, column: 10 });
  });

  // @lat: [[tests/ladybug-backend#Renderer unchanged]]
  it('renders a Ladybug result from a real sidecar exactly like a built-in one', async () => {
    if (!('lbug' in (await loadLadybug()))) return;
    const root = mkdtempSync(join(tmpdir(), 'obsigraph-remote-'));
    const vault = join(root, 'vault');
    mkdirSync(vault);
    mkdirSync(join(root, 'data'));
    const notes: Record<string, string> = { 'Alice.md': '---\ntype: Person\n---\nknows:: [[Bob]] {since: 2020}\n-distrusts:: [[Eve]]', 'Bob.md': '', 'Eve.md': '' };
    for (const [p, t] of Object.entries(notes)) writeFileSync(join(vault, p), t);
    const sc = await startSidecar({ OBSIGRAPH_VAULT: vault, OBSIGRAPH_DATA: join(root, 'data'), OBSIGRAPH_TOKEN: 't', OBSIGRAPH_PORT: '0', OBSIGRAPH_VECTORS: '0' }, { log: () => {} });
    try {
      await sc.mirror!.idle();
      const q = 'MATCH (a:Person)-[r]->(b) RETURN a, r, b ORDER BY r.id';
      const remote = await runRemote(nodeFetch, { url: `http://127.0.0.1:${sc.port}`, token: 't' }, q);
      expect(remote.kind).toBe('result');
      if (remote.kind !== 'result') return;
      expect(remote.result.rows[0]![0]).toBeInstanceOf(NodeRef);
      expect(remote.result.rows[0]![1]).toBeInstanceOf(RelRef);

      const graph = new Graph(pathResolver(() => Object.keys(notes)));
      for (const [path, text] of Object.entries(notes)) graph.upsertNote({ path, text: text.replace(/^---[\s\S]*?---\n/, ''), frontmatter: path === 'Alice.md' ? { type: 'Person' } : null });
      const local = new BuiltinEngine(graph).run(q);
      expect(resultToJson(remote.result)).toEqual(JSON.parse(JSON.stringify(resultToJson(local))));
      const opts = parseBlock(q).options;
      const a = planRender(remote.result, opts, 500, (id) => graph.node(id));
      const b = planRender(local, opts, 500, (id) => graph.node(id));
      expect(a).toEqual(b);
      expect(a.kind).toBe('graph');
    } finally {
      await sc.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
