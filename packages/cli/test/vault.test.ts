import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { run } from '../src/cli.mjs';
import '../src/commands/index.mjs';

function vault(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-vault-'));
  const put = (p: string, t: string) => {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    writeFileSync(join(dir, p), t);
  };
  put('People/Alice.md', '---\ntype: Person\n---\nAlice is a researcher.\n\nknows:: [[Bob]] {since: 2020}\n-distrusts:: [[Eve]]\n\nShe also reads [[Missing Note]].\n\nSince {{edge: Alice -knows-> Bob . since}}.\n');
  put('People/Bob.md', '# Bob\n\nBob is an engineer.\n');
  put('People/Eve.md', 'Eve is an outsider.\n');
  put('Overview.md', '# Overview\n\nSee [[Alice]] and [[People/Bob]].\n');
  put('.obsidian/app.json', '{}');
  return dir;
}

async function tg(cwd: string, ...args: string[]) {
  let out = '';
  let err = '';
  const code = await run(args, { cwd, out: (t) => (out += t), err: (t) => (err += t), env: {} });
  return { code, out, err };
}

const read = (...p: string[]) => readFileSync(join(...p), 'utf8');
const hasLat = spawnSync('lat', ['--version'], { encoding: 'utf8' }).status === 0;

// @lat: [[tests/tg-vault#Export projection#Typed edge flattened]]
// @tg: verifies:: [[openspec:lat-vault-integration#Export projection#Typed edge flattened]]
it('flattens typed edges to plain links and drops property blocks', async () => {
  const v = vault();
  const out = mkdtempSync(join(tmpdir(), 'tg-out-'));
  const r = await tg(v, 'export', out);
  expect(r.code).toBe(0);
  const alice = read(out, 'lat.md/People/Alice.md');
  expect(alice).toContain('knows: [[Bob]]');
  expect(alice).toContain('distrusts (negative): [[Eve]]');
  expect(alice).not.toContain('{since');
  expect(alice).toContain('Since 2020.');
  expect(alice).toContain('She also reads Missing Note.');
  expect(alice.startsWith('---\ntype: Person\n---\n# Alice\n')).toBe(true);
  expect(read(v, 'People/Alice.md')).toContain('knows:: [[Bob]] {since: 2020}');
});

// @lat: [[tests/tg-vault#Export projection#Valid output]]
// @tg: verifies:: [[openspec:lat-vault-integration#Export projection#Valid output]]
it('writes a project that tg check and lat check both accept', async () => {
  const v = vault();
  const out = mkdtempSync(join(tmpdir(), 'tg-out-'));
  const r = await tg(v, 'export', out);
  expect(r.out).toContain('Verified: tg check passes on the output.');
  expect(existsSync(join(out, 'lat.md/lat.md'))).toBe(true);
  expect(existsSync(join(out, 'lat.md/People/People.md'))).toBe(true);
  expect(existsSync(join(out, 'lat.md/.obsidian'))).toBe(false);
  expect((await tg(out, 'check')).code).toBe(0);
  if (hasLat) {
    const lat = spawnSync('lat', ['check', '--no-color'], { cwd: out, encoding: 'utf8' });
    expect(`${lat.stdout}${lat.stderr}`).toContain('All checks passed');
  }
});

// @lat: [[tests/tg-vault#Loss report#Report shown]]
// @tg: verifies:: [[openspec:lat-vault-integration#Loss report#Report shown]]
it('reports each dropped construct by kind', async () => {
  const r = await tg(vault(), 'export', mkdtempSync(join(tmpdir(), 'tg-out-')), '--json');
  const json = JSON.parse(r.out) as { report: { kind: string; count: number }[] };
  const count = (k: string) => json.report.find((e) => e.kind === k)?.count ?? 0;
  expect(count('typed-edge')).toBe(2);
  expect(count('edge-properties')).toBe(1);
  expect(count('negative-edge')).toBe(1);
  expect(count('edge-embed')).toBe(1);
  expect(count('unresolved-link')).toBe(1);
  expect(count('added-heading')).toBe(2);
  expect(count('generated-index')).toBe(2);
  const text = (await tg(vault(), 'export', mkdtempSync(join(tmpdir(), 'tg-out-')))).out;
  expect(text).toContain('round trip is not guaranteed');
});

// @lat: [[tests/tg-vault#Safe export target#Non-empty target]]
// @tg: verifies:: [[openspec:lat-vault-integration#Safe export target#Non-empty target]]
it('refuses to overwrite a non-empty target unless forced', async () => {
  const v = vault();
  const out = mkdtempSync(join(tmpdir(), 'tg-out-'));
  writeFileSync(join(out, 'keep.txt'), 'mine');
  const r = await tg(v, 'export', out);
  expect(r.code).toBe(2);
  expect(readdirSync(out)).toEqual(['keep.txt']);
  expect((await tg(v, 'export', out, '--force')).code).toBe(0);
  expect(read(out, 'keep.txt')).toBe('mine');
  expect((await tg(v, 'export', join(v, 'sub'))).code).toBe(2);
});

// @lat: [[tests/tg-vault#Import#Copy]]
// @tg: verifies:: [[openspec:lat-vault-integration#Import#Copy]]
it('copies an existing lat.md folder into a vault and leaves the source unchanged', async () => {
  const src = mkdtempSync(join(tmpdir(), 'tg-src-'));
  mkdirSync(join(src, 'lat.md'));
  writeFileSync(join(src, 'lat.md/lat.md'), '# Lat\n\nIndex.\n\n- [[a]] — a\n');
  writeFileSync(join(src, 'lat.md/a.md'), '# A\n\nText.\n');
  const snapshot = (d: string): string[] => readdirSync(d, { withFileTypes: true, recursive: true }).map((e) => `${e.parentPath}/${e.name}:${e.isDirectory() ? 0 : statSync(join(e.parentPath, e.name)).mtimeMs}`).sort();
  const before = snapshot(src);
  const dest = mkdtempSync(join(tmpdir(), 'tg-dest-'));
  const r = await tg(dest, 'import', join(src, 'lat.md'));
  expect(r.code).toBe(0);
  expect(read(dest, 'lat.md/a.md')).toBe('# A\n\nText.\n');
  expect(snapshot(src)).toEqual(before);
  expect((await tg(dest, 'import', join(src, 'lat.md'))).code).toBe(2);
  const mounted = mkdtempSync(join(tmpdir(), 'tg-mount-'));
  expect((await tg(mounted, 'import', src, '--mount')).code).toBe(0);
  expect(read(mounted, 'lat.md/a.md')).toContain('# A');
  expect((await tg(mounted, 'check')).code).toBe(0);
});
