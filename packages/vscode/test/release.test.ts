import { expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { release } from '../../../scripts/release-vscode.mjs';

type Call = [string, string[]];

// @lat: [[tests/vscode-extension#Release#Refuses with a missing token]]
// @tg: verifies:: [[openspec:vscode-extension#Dual-registry publishing#One package, two registries]]
it('publishes to neither registry when a token is missing', () => {
  const calls: Call[] = [];
  const run = (c: string, a: string[]) => void calls.push([c, a]);
  expect(() => release({ env: { VSCE_PAT: 'x' }, run })).toThrow(/OVSX_PAT/);
  expect(() => release({ env: { OVSX_PAT: 'y' }, run })).toThrow(/VSCE_PAT/);
  expect(() => release({ env: {}, run })).toThrow(/nothing was published/);
  expect(calls).toEqual([]);
});

// @lat: [[tests/vscode-extension#Release#Same package to both]]
// @tg: verifies:: [[openspec:vscode-extension#Dual-registry publishing#One package, two registries]]
it('publishes the same vsix to the Marketplace and Open VSX', () => {
  const calls: Call[] = [];
  const done = release({ env: { VSCE_PAT: 'a', OVSX_PAT: 'b' }, vsix: 'one.vsix', run: (c: string, a: string[]) => void calls.push([c, a]) }) as string[];
  expect(done).toEqual(['VS Code Marketplace', 'Open VSX']);
  expect(calls).toHaveLength(2);
  expect(calls.every(([, args]) => args.includes('one.vsix'))).toBe(true);
  expect(calls[0]![1]).toContain('a');
  expect(calls[1]![1]).toContain('b');
  const dry: Call[] = [];
  release({ env: { VSCE_PAT: 'a', OVSX_PAT: 'b' }, dryRun: true, run: (c: string, a: string[]) => void dry.push([c, a]) });
  expect(dry).toEqual([]);
});
