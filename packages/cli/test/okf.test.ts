import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { run } from '../src/cli.mjs';
import '../src/commands/index.mjs';

function folder(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-okf-'));
  for (const [p, t] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    writeFileSync(join(dir, p), t);
  }
  return dir;
}

async function tg(cwd: string, ...args: string[]) {
  let out = '';
  let err = '';
  const code = await run(args, { cwd, out: (t) => (out += t), err: (t) => (err += t), env: {} });
  return { code, out, err };
}

// @lat: [[tests/okf-compat#Check#Check command exit codes]]
it('exits 0 on a conformant bundle and 1 on conformance errors', async () => {
  const good = folder({
    'index.md': '---\nokf_version: "0.2"\n---\n# Bundle\n\n* [Orders](tables/orders.md) - Orders.\n',
    'tables/orders.md': '---\ntype: BigQuery Table\ndescription: One row per order.\n---\n# Schema\n\nJoined with [customers](/tables/customers.md).\n',
  });
  const ok = await tg(good, 'okf', 'check');
  expect(ok.code).toBe(0);
  expect(ok.out).toContain('Conformant with OKF v0.2');
  expect(ok.out).toContain('1 warning');

  const bad = folder({ 'a.md': '# No frontmatter\n', 'b.md': '---\ntitle: B\n---\n' });
  const r = await tg(bad, 'okf', 'check', '--json');
  expect(r.code).toBe(1);
  const json = JSON.parse(r.out) as { ok: boolean; errors: { kind: string }[] };
  expect(json.ok).toBe(false);
  expect(json.errors.map((e) => e.kind)).toEqual(['missing-frontmatter', 'missing-type']);
  expect((await tg(bad, 'okf')).code).toBe(2);
});

// @lat: [[tests/okf-compat#Check#Export command verifies]]
it('exports a vault as a verified OKF bundle with a change report', async () => {
  const v = folder({
    'People/Alice.md': '---\ntype: Person\n---\nAlice is a researcher.\n\nknows:: [[Bob]] {since: 2020}\n\n![[diagram.png]]\n',
    'People/Bob.md': 'Bob is an engineer.\n',
    'assets/diagram.png': 'png',
    '.obsidian/app.json': '{}',
  });
  const out = mkdtempSync(join(tmpdir(), 'tg-okf-out-'));
  const r = await tg(v, 'export', out, '--format', 'okf', '--default-type', 'Concept', '--json');
  expect(r.code).toBe(0);
  const json = JSON.parse(r.out) as { format: string; attachments: number; report: { kind: string; count: number }[]; errors: unknown[] };
  expect(json.format).toBe('okf');
  expect(json.errors).toEqual([]);
  expect(json.attachments).toBe(1);
  const count = (k: string) => json.report.find((e) => e.kind === k)?.count ?? 0;
  expect(count('default-type')).toBe(1);
  expect(count('attachment')).toBe(1);
  expect(count('generated-index')).toBe(2);
  const alice = readFileSync(join(out, 'People/Alice.md'), 'utf8');
  expect(alice).toContain('knows:: [Bob](/People/Bob.md) {since: 2020}');
  expect(alice).toContain('![diagram.png](/assets/diagram.png)');
  expect(readFileSync(join(out, 'People/Bob.md'), 'utf8')).toContain('type: Concept');
  expect(existsSync(join(out, 'assets/diagram.png'))).toBe(true);
  expect(existsSync(join(out, 'index.md'))).toBe(true);
  expect(existsSync(join(out, 'lat.md'))).toBe(false);
  expect((await tg(out, 'okf', 'check')).code).toBe(0);
  const text = await tg(v, 'export', mkdtempSync(join(tmpdir(), 'tg-okf-out-')), '--format', 'okf');
  expect(text.out).toContain('Verified: tg okf check passes on the output.');
  expect((await tg(v, 'export', out, '--format', 'okf')).code).toBe(2);
  expect((await tg(v, 'export', out, '--format', 'json')).code).toBe(2);
});
