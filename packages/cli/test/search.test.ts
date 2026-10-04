import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { run } from '../src/cli.mjs';
import '../src/commands/index.mjs';

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-search-'));
  mkdirSync(join(dir, 'lat.md'));
  const put = (p: string, t: string) => writeFileSync(join(dir, 'lat.md', p), t);
  put('lat.md', '# Lat\n\nIndex.\n\n- [[syntax]] — s\n- [[notes]] — n\n- [[access]] — a\n');
  put('syntax.md', '# Edge Syntax\n\nHow typed edges are written in notes.\n');
  put('notes.md', '# Notes\n\nGeneral notes.\n\n## Misc\n\nThis body mentions edge syntax once in passing.\n');
  put('access.md', '# Access\n\nHow people sign in with credentials.\n');
  return dir;
}

/** A fake embedding service: concepts become dimensions, so "login" is near "sign in". */
function fakeFetch(opts: { fail?: boolean } = {}) {
  const calls: { url: string; headers: Record<string, string>; inputs: string[] }[] = [];
  const vec = (t: string): number[] => {
    const s = t.toLowerCase();
    return [/login|sign in|credential/.test(s) ? 1 : 0, /graph|edge|node/.test(s) ? 1 : 0, 0.01];
  };
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const body = JSON.parse(String(init?.body)) as { input: string[] };
    calls.push({ url: u, headers: (init?.headers ?? {}) as Record<string, string>, inputs: body.input });
    if (opts.fail) throw new Error('connect ECONNREFUSED');
    const vectors = body.input.map(vec);
    const json = u.endsWith('/api/embed') ? { embeddings: vectors } : { data: vectors.map((embedding, index) => ({ index, embedding })) };
    return new Response(JSON.stringify(json), { status: 200 });
  }) as typeof fetch;
  return { impl, calls };
}

async function tg(cwd: string, env: Record<string, string>, f: typeof fetch | undefined, ...args: string[]) {
  let out = '';
  let err = '';
  const code = await run(args, { cwd, out: (t) => (out += t), err: (t) => (err += t), env, fetch: f });
  return { code, out, err };
}

// @lat: [[tests/tg-search#Lexical default#No configuration]]
it('searches lexically with no configuration and no network', async () => {
  const dir = project();
  const forbidden = (async () => {
    throw new Error('network used');
  }) as unknown as typeof fetch;
  const r = await tg(dir, {}, forbidden, 'search', 'typed edges');
  expect(r.code).toBe(0);
  expect(r.out).toContain('(lexical match)');
  expect(r.out).toContain('[[lat.md/syntax#Edge Syntax]]');
});

// @lat: [[tests/tg-search#Lexical default#Title outranks body]]
it('ranks the section titled with the query above one that only mentions it', async () => {
  const r = await tg(project(), {}, undefined, 'search', 'edge syntax', '--json');
  const ids = (JSON.parse(r.out) as { hits: { id: string }[] }).hits.map((h) => h.id);
  expect(ids[0]).toBe('lat.md/syntax#Edge Syntax');
  expect(ids).toContain('lat.md/notes#Notes#Misc');
});

// @lat: [[tests/tg-search#Hybrid ranking#Provider configured]]
it('fuses lexical and vector ranks when a provider is configured', async () => {
  const dir = project();
  const f = fakeFetch();
  const lexicalOnly = await tg(dir, {}, undefined, 'search', 'login', '--json');
  expect((JSON.parse(lexicalOnly.out) as { hits: unknown[] }).hits).toHaveLength(0);
  const r = await tg(dir, { TG_EMBED_PROVIDER: 'ollama' }, f.impl, 'search', 'login', '--json');
  const j = JSON.parse(r.out) as { mode: string; hits: { id: string }[] };
  expect(j.mode).toBe('hybrid');
  expect(j.hits[0]!.id).toBe('lat.md/access#Access');
  expect(f.calls.some((c) => c.url.endsWith('/api/embed'))).toBe(true);
});

// @lat: [[tests/tg-search#Hybrid ranking#Provider down]]
it('falls back to lexical results with a notice when the provider fails', async () => {
  const f = fakeFetch({ fail: true });
  const r = await tg(project(), { TG_EMBED_PROVIDER: 'ollama' }, f.impl, 'search', 'typed edges');
  expect(r.code).toBe(0);
  expect(r.out).toContain('Note: embeddings unavailable');
  expect(r.out).toContain('(lexical match)');
});

// @lat: [[tests/tg-search#Key variable aliases#Alias honored]]
it('uses LAT_LLM_KEY as the provider key', async () => {
  const f = fakeFetch();
  const r = await tg(project(), { LAT_LLM_KEY: 'sk-test-123' }, f.impl, 'search', 'login', '--json');
  expect((JSON.parse(r.out) as { mode: string }).mode).toBe('hybrid');
  expect(f.calls[0]!.url).toBe('https://api.openai.com/v1/embeddings');
  expect(f.calls[0]!.headers.authorization).toBe('Bearer sk-test-123');
});

// @lat: [[tests/tg-search#Key variable aliases#Not written to disk]]
it('never persists a key', async () => {
  const dir = project();
  await tg(dir, { LAT_LLM_KEY: 'sk-secret-xyz' }, fakeFetch().impl, 'search', 'login');
  const files = readdirSync(join(dir, '.tg'));
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) expect(readFileSync(join(dir, '.tg', f), 'utf8')).not.toContain('sk-secret-xyz');
});

// @lat: [[tests/tg-search#Derived cache#Cache deleted]]
it('recreates a deleted cache and reuses unchanged vectors on reindex', async () => {
  const dir = project();
  const env = { TG_EMBED_PROVIDER: 'ollama' };
  const f = fakeFetch();
  const first = await tg(dir, env, f.impl, 'reindex');
  expect(first.out).toMatch(/\d+ embedded, 0 reused/);
  const again = await tg(dir, env, f.impl, 'reindex');
  expect(again.out).toMatch(/0 embedded, \d+ reused/);
  rmSync(join(dir, '.tg'), { recursive: true });
  const r = await tg(dir, env, f.impl, 'search', 'login');
  expect(r.code).toBe(0);
  expect(readdirSync(join(dir, '.tg'))).toContain('vectors.json');
});
