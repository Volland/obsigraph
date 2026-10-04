import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../src/cli.mjs';
import '../src/commands/index.mjs';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const SEEDED = join(FIXTURES, 'seeded');
const UPSTREAM = join(FIXTURES, 'upstream-lat-md');
const REPO = join(import.meta.dirname, '..', '..', '..');

async function tg(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = '';
  let err = '';
  const code = await run(args, { cwd, out: (t) => (out += t), err: (t) => (err += t), env: {} });
  return { code, out, err };
}

// @lat: [[tests/tg-check#Locate and section#Fuzzy locate]]
it('locates a section by fuzzy name', async () => {
  const r = await tg(SEEDED, 'locate', 'Rejects expird');
  expect(r.code).toBe(0);
  expect(r.out).toContain('[[lat.md/tests/login#Login#Rejects expired]]');
  expect(r.out).toContain('Defined in lat.md/tests/login.md:');
  const miss = await tg(SEEDED, 'locate', 'zzzqqq');
  expect(miss.code).toBe(1);
});

// @lat: [[tests/tg-check#Locate and section#Incoming references]]
it('lists incoming references and the referencing code under a section', async () => {
  const r = await tg(SEEDED, 'section', 'login#Login#Checks token');
  expect(r.code).toBe(0);
  expect(r.out).toContain('## Referenced by:');
  expect(r.out).toContain('[[lat.md/guide#Guide#Setup]]');
  expect(r.out).toContain('## Referenced by code:');
  expect(r.out).toContain('src/auth.ts:1');
});

// @lat: [[tests/tg-check#Refs and expand#Code reference listed]]
it('refs lists code that references a section', async () => {
  const r = await tg(SEEDED, 'refs', 'login#Login#Checks token');
  expect(r.out).toContain('## Code references:');
  expect(r.out).toContain('* src/auth.ts:1');
  const md = await tg(SEEDED, 'refs', '--scope', 'md', 'login#Login#Checks token');
  expect(md.out).not.toContain('Code references');
});

// @lat: [[tests/tg-check#Refs and expand#Expand text]]
it('expand replaces refs with full ids and locations', async () => {
  const r = await tg(SEEDED, 'expand', 'see [[login#Checks token]] now');
  expect(r.out).toContain('see [[lat.md/tests/login#Login#Checks token]] now');
  expect(r.out).toContain('<lat-context>');
  expect(r.out).toMatch(/lat\.md\/tests\/login\.md:\d+-\d+/);
  const bad = await tg(SEEDED, 'expand', '[[zzz]]');
  expect(bad.code).toBe(1);
  expect(bad.out).toContain('Ask the user to correct the reference.');
});

// @lat: [[tests/tg-check#Check#Uncovered test spec]]
it('check reports an uncovered require-code-mention section and exits 1', async () => {
  const r = await tg(SEEDED, 'check');
  expect(r.code).toBe(1);
  expect(r.out).toContain('lat.md/tests/login.md:13: section "lat.md/tests/login#Login#Rejects expired" requires a code mention but none found');
  expect(r.out).not.toContain('Checks token" requires');
});

// @lat: [[tests/tg-check#Check#Clean project]]
it('check passes a clean project', async () => {
  const r = await tg(REPO, 'check');
  expect(r.out).toContain('All checks passed');
  expect(r.code).toBe(0);
});

// ---- parity with lat.md -------------------------------------------------------------

const hasLat = spawnSync('lat', ['--version'], { encoding: 'utf8' }).status === 0;

/** Intentional differences, each justified in lat.md/cli: tg accepts Node ES-module and CommonJS source extensions. */
const DIFFERENCES = [{ pattern: /\[\[[^\]]*\.(?:mjs|cjs|mts|cts)(?:#[^\]]*)?\]\] — .*$/, replacement: '[[<node-source-link>]] — <differs>' }];

function normalize(line: string): string {
  let l = line.trim();
  for (const d of DIFFERENCES) l = l.replace(d.pattern, d.replacement);
  return l;
}

function findings(text: string): string[] {
  const out: string[] = [];
  let cur: string[] | null = null;
  for (const raw of text.split('\n')) {
    if (raw.startsWith('- ')) {
      if (cur) out.push(normalize(cur[0]!));
      cur = [raw.slice(2)];
    } else if (cur && raw.startsWith('  ')) cur.push(raw);
    else if (raw === '' && cur) {
      out.push(normalize(cur[0]!));
      cur = null;
    }
  }
  if (cur) out.push(normalize(cur[0]!));
  return out.sort();
}

function latFindings(dir: string): string[] {
  const r = spawnSync('lat', ['check', '--no-color'], { cwd: dir, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  return findings(`${r.stdout}\n${r.stderr}`);
}

describe.skipIf(!hasLat)('parity with lat check', () => {
  // @lat: [[tests/tg-check#Parity with lat.md#This repository]]
  it('agrees on this repository', async () => {
    const mine = findings((await tg(REPO, 'check')).out);
    expect(latFindings(REPO)).toEqual(mine);
    expect(mine).toEqual([]);
  });

  // @lat: [[tests/tg-check#Parity with lat.md#Seeded breakage]]
  it('reports the same findings on a seeded project', async () => {
    const lat = latFindings(SEEDED);
    expect(lat.length).toBeGreaterThanOrEqual(7);
    expect(findings((await tg(SEEDED, 'check')).out)).toEqual(lat);
  });

  // @lat: [[tests/tg-check#Parity with lat.md#Upstream project]]
  it('reports the same findings on a snapshot of the upstream lat.md project', async () => {
    const lat = latFindings(UPSTREAM);
    expect(lat.length).toBeGreaterThan(100);
    expect(findings((await tg(UPSTREAM, 'check')).out)).toEqual(lat);
  }, 60_000);
});
