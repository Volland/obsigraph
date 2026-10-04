import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { run, type Io } from '../../cli/src/cli.mjs';
import '../../cli/src/commands/index.mjs';
import { needsSetup, runSetup, SETUP_FILES, setupCommand } from '../src/setup';

function deps(hasTg: boolean, answer: boolean) {
  const calls = { confirmed: [] as { files: readonly string[]; command: string }[], ran: [] as string[] };
  return {
    calls,
    deps: {
      hasGlobalTg: () => hasTg,
      confirm: async (files: readonly string[], command: string) => {
        expect(calls.ran).toEqual([]);
        calls.confirmed.push({ files, command });
        return answer;
      },
      runInTerminal: (c: string) => void calls.ran.push(c),
    },
  };
}

// @lat: [[tests/vscode-extension#Set up TypeGraph#Confirmation first]]
it('lists the files before running anything and runs nothing when declined', async () => {
  const yes = deps(true, true);
  expect(await runSetup(yes.deps)).toBe(true);
  expect(yes.calls.confirmed[0]!.files).toEqual(SETUP_FILES);
  expect(yes.calls.ran).toEqual(['tg init --write']);
  const no = deps(true, false);
  expect(await runSetup(no.deps)).toBe(false);
  expect(no.calls.confirmed).toHaveLength(1);
  expect(no.calls.ran).toEqual([]);
});

// @lat: [[tests/vscode-extension#Set up TypeGraph#Global tg preferred]]
it('uses a global tg when present and npx otherwise', () => {
  expect(setupCommand(true)).toBe('tg init --write');
  expect(setupCommand(false)).toBe('npx @typedgraph/cli init --write');
});

// @lat: [[tests/vscode-extension#Set up TypeGraph#File list matches the CLI]]
it('lists exactly the files tg init plans for a fresh project', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgvs-init-'));
  let out = '';
  const io: Io = { cwd: dir, out: (t) => (out += t), err: () => {}, env: {}, stdin: () => '' };
  expect(await run(['init', '--json'], io)).toBe(0);
  const planned = (JSON.parse(out) as { changes: { path: string }[] }).changes.map((c) => c.path).sort();
  expect(planned).toEqual([...SETUP_FILES].sort());
  expect(readdirSync(dir)).toEqual([]);
});

// @lat: [[tests/vscode-extension#Set up TypeGraph#Detects finished setup]]
it('needs setup without lat.md or a tg block and not with both', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgvs-need-'));
  expect(needsSetup(dir)).toBe(true);
  mkdirSync(join(dir, 'lat.md'));
  expect(needsSetup(dir)).toBe(true);
  writeFileSync(join(dir, 'CLAUDE.md'), '%% lat:begin %%\nold\n%% lat:end %%\n');
  expect(needsSetup(dir)).toBe(true);
  writeFileSync(join(dir, 'CLAUDE.md'), `${readFileSync(join(dir, 'CLAUDE.md'), 'utf8')}\n%% tg:begin %%\nx\n%% tg:end %%\n`);
  expect(needsSetup(dir)).toBe(false);
});
