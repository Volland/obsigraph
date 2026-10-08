import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startSidecar, type Sidecar } from '../src/main.mjs';
import { loadLadybug } from '../src/mirror/store.mjs';

const VAULT = join(__dirname, '../../../example');
const available = 'lbug' in (await loadLadybug());

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.name.startsWith('.') ? [] : e.isDirectory() ? markdownFiles(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  );
}

/** Every example whose header starts with `backend: ladybug`, up to its closing fence; the query follows the first blank line. */
const examples = markdownFiles(VAULT).flatMap((f) =>
  [...readFileSync(f, 'utf8').matchAll(/^backend: ladybug\n([\s\S]*?)^(?:`{3,}|~{3,})\s*$/gm)].map((m, i) => ({
    name: `${relative(VAULT, f)} #${i + 1}`,
    query: m[1]!.slice(m[1]!.indexOf('\n\n') + 2).trim() || m[1]!.trim(),
  })),
);

let sc: Sidecar;
let data: string;

beforeAll(async () => {
  if (!available) return;
  data = mkdtempSync(join(tmpdir(), 'obsigraph-example-'));
  sc = await startSidecar({ OBSIGRAPH_VAULT: VAULT, OBSIGRAPH_DATA: data, OBSIGRAPH_TOKEN: 't', OBSIGRAPH_PORT: '0', OBSIGRAPH_VECTORS: '0' }, { log: () => {} });
  await sc.mirror!.idle();
});
afterAll(async () => {
  await sc?.stop();
  if (data) rmSync(data, { recursive: true, force: true });
});

describe.skipIf(!available)('example vault on LadybugDB', () => {
  it('has LadybugDB examples to check', () => {
    expect(examples.length).toBeGreaterThanOrEqual(4);
  });

  // @lat: [[tests/example-vault#Ladybug examples run]]
  // @tg: verifies:: [[openspec:example-vault#Ladybug examples run#Pass-through examples match the mirror]]
  it.each(examples.map((e) => [e.name, e] as const))('%s returns rows on LadybugDB', async (_, e) => {
    const res = await fetch(`http://127.0.0.1:${sc.port}/query`, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ query: e.query, backend: 'ladybug' }) });
    const body = (await res.json()) as { rows?: unknown[]; error?: { message: string } };
    expect(body.error?.message).toBeUndefined();
    expect(body.rows!.length).toBeGreaterThan(0);
  });
});
