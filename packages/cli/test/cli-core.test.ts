import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { register, run, type Command, type Io } from '../src/cli.mjs';
import { findRoot } from '../src/root.mjs';

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-'));
  mkdirSync(join(dir, 'lat.md'));
  mkdirSync(join(dir, 'src', 'auth'), { recursive: true });
  return dir;
}

function io(cwd: string): Io & { outs: string[]; errs: string[] } {
  const outs: string[] = [];
  const errs: string[] = [];
  return { cwd, out: (t) => void outs.push(t), err: (t) => void errs.push(t), env: {}, outs, errs };
}

const probe: Command = {
  name: 'probe',
  summary: 'test command',
  run: (ctx, args) => {
    ctx.out(ctx.json ? JSON.stringify({ root: ctx.root, args }) : `root ${ctx.root}\n`);
    return args[0] === 'bad' ? 1 : 0;
  },
};
register(probe);

// @lat: [[tests/cli-core#Project root discovery#Run from a subdirectory]]
// @tg: verifies:: [[openspec:tg-cli#Project root discovery#Run from a subdirectory]]
it('finds the root from a subdirectory', () => {
  const dir = project();
  expect(findRoot(join(dir, 'src', 'auth'))).toBe(dir);
});

// @lat: [[tests/cli-core#Project root discovery#Explicit directory]]
// @tg: verifies:: [[openspec:tg-cli#Project root discovery#Explicit directory]]
it('--dir overrides the working directory', async () => {
  const a = project();
  const b = project();
  const h = io(a);
  const code = await run(['--dir', b, 'probe'], h);
  expect(code).toBe(0);
  expect(h.outs.join('')).toContain(b);
});

// @lat: [[tests/cli-core#Project root discovery#No project found]]
// @tg: verifies:: [[openspec:tg-cli#Project root discovery#No project found]]
it('exits 2 with an init hint when no project exists', async () => {
  const empty = mkdtempSync(join(tmpdir(), 'tg-empty-'));
  writeFileSync(join(empty, 'x'), '');
  const h = io(empty);
  expect(await run(['probe'], h)).toBe(2);
  expect(h.errs.join('')).toContain('tg init');
});

// @lat: [[tests/cli-core#Output and exit codes#Findings]]
// @tg: verifies:: [[openspec:tg-cli#Output and exit codes#Findings]]
it('a command reporting findings exits 1', async () => {
  const dir = project();
  expect(await run(['probe', 'bad'], io(dir))).toBe(1);
});

// @lat: [[tests/cli-core#Output and exit codes#JSON output]]
// @tg: verifies:: [[openspec:tg-cli#Output and exit codes#JSON output]]
it('--json prints one JSON document and nothing else', async () => {
  const dir = project();
  const h = io(dir);
  await run(['probe', 'x', '--json'], h);
  expect(h.outs).toHaveLength(1);
  expect(JSON.parse(h.outs[0]!)).toEqual({ root: dir, args: ['x'] });
});

// @lat: [[tests/cli-core#Single bundled package#Clean install]]
// @tg: verifies:: [[openspec:tg-cli#Single bundled package#Clean install]]
it('the bundle has no runtime dependencies on other packages', async () => {
  const { readFileSync } = await import('node:fs');
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'));
  expect(pkg.dependencies ?? {}).toEqual({});
  expect(pkg.bin).toEqual({ tg: 'dist/tg.mjs' });
  const h = io(process.cwd());
  expect(await run(['--version'], h)).toBe(0);
  expect(h.outs.join('')).toMatch(/\S/);
});
