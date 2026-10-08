import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { backlinksFor, panelRows } from '../src/backlinks';
import { GraphSession } from '../src/graph-session';
import { WorkspaceIndex } from '../src/workspace-index';

export function workspace(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'tgvs-'));
  for (const [rel, text] of Object.entries(files)) {
    const full = join(dir, ...rel.split('/'));
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  }
  return dir;
}

const FILES: Record<string, string> = {
  'notes/Alice.md': 'knows:: [[Bob]] {since: 2020}\n-distrusts:: [[Eve]]\n',
  'notes/Carol.md': 'knows:: [[Bob]]\nblocks:: [[Bob]]\n',
  'notes/Bob.md': '',
  'notes/Eve.md': '',
  'lat.md/architecture.md': '# Architecture\n\nOverview.\n\n## Monorepo layout\n\nThree packages.\n',
  'src/auth.ts': '// @lat: [[architecture#Monorepo layout]]\nexport function login() {}\n',
  'src/plain.ts': 'export const x = 1;\n',
  'node_modules/pkg/README.md': 'knows:: [[Bob]]\n',
  '.hidden/secret.md': 'knows:: [[Bob]]\n',
  'docs/outside.md': 'knows:: [[Bob]]\n',
};

async function index(roots = ['.'], files = FILES) {
  const dir = workspace(files);
  const idx = new WorkspaceIndex({ workspace: dir, roots, ignore: ['node_modules'] });
  await idx.load();
  return { dir, idx };
}

// @lat: [[tests/vscode-extension#Indexer#Roots and ignores]]
// @tg: verifies:: [[openspec:vscode-extension#Configurable roots#Monorepo noise]]
// @tg: verifies:: [[openspec:vscode-extension#Configurable roots#Nested vault]]
it('indexes only the roots and never dot or ignored folders', async () => {
  const { idx } = await index(['notes', 'lat.md', 'src']);
  expect(idx.isNote('notes/Alice.md')).toBe(true);
  expect(idx.isNote('docs/outside.md')).toBe(false);
  const all = await index();
  expect(all.idx.isNote('node_modules/pkg/README.md')).toBe(false);
  expect(all.idx.isNote('.hidden/secret.md')).toBe(false);
  expect(all.idx.isNote('docs/outside.md')).toBe(true);
  expect(all.idx.accepts('notes/x.md')).toBe(true);
  expect(idx.accepts('docs/x.md')).toBe(false);
});

// @lat: [[tests/vscode-extension#Indexer#Live update]]
// @tg: verifies:: [[openspec:vscode-extension#Index the workspace in process#Live update]]
it('reflects a saved edge and a deleted note without reloading', async () => {
  const { dir, idx } = await index();
  expect(backlinksFor(idx, 'notes/Eve.md').groups.map((g) => g.title)).toEqual(['distrusts']);
  writeFileSync(join(dir, 'notes/Bob.md'), 'likes:: [[Eve]]\n');
  await idx.update('notes/Bob.md');
  expect(backlinksFor(idx, 'notes/Eve.md').groups.map((g) => g.title)).toEqual(['distrusts', 'likes']);
  rmSync(join(dir, 'notes/Bob.md'));
  await idx.update('notes/Bob.md');
  expect(backlinksFor(idx, 'notes/Eve.md').groups.map((g) => g.title)).toEqual(['distrusts']);
  expect(idx.isNote('notes/Bob.md')).toBe(false);
});

const snapshot = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => {
      const p = join(e.parentPath, e.name);
      return `${p}:${statSync(p).mtimeMs}:${readFileSync(p, 'utf8')}`;
    })
    .sort();

// @lat: [[tests/vscode-extension#Indexer#Read-only]]
it('leaves the workspace byte-identical', async () => {
  const dir = workspace(FILES);
  const before = snapshot(dir);
  const idx = new WorkspaceIndex({ workspace: dir, roots: ['.'], ignore: ['node_modules'] });
  await idx.load();
  await idx.update('notes/Alice.md');
  expect(snapshot(dir)).toEqual(before);
});

// @lat: [[tests/vscode-extension#Backlinks#Grouped by type]]
// @tg: verifies:: [[openspec:vscode-extension#Typed backlinks for notes#Grouped by type]]
it('groups incoming edges by type with source and line', async () => {
  const { idx } = await index();
  const r = backlinksFor(idx, 'notes/Bob.md');
  expect(r.kind).toBe('note');
  expect(r.groups.map((g) => [g.title, g.items.map((i) => i.path)])).toEqual([
    ['blocks', ['notes/Carol.md']],
    ['knows', ['docs/outside.md', 'notes/Alice.md', 'notes/Carol.md']],
  ]);
  expect(r.groups[1]!.items[1]).toMatchObject({ label: 'Alice', line: 1, sign: 1, props: { since: 2020 } });
});

// @lat: [[tests/vscode-extension#Backlinks#Negative edge sign]]
// @tg: verifies:: [[openspec:vscode-extension#Typed backlinks for notes#Negative edge]]
it('marks a negative incoming edge', async () => {
  const { idx } = await index();
  const g = backlinksFor(idx, 'notes/Eve.md').groups[0]!;
  expect(g.title).toBe('distrusts');
  expect(g.items[0]).toMatchObject({ path: 'notes/Alice.md', sign: -1 });
});

// @lat: [[tests/vscode-extension#Backlinks#Code to spec]]
// @tg: verifies:: [[openspec:vscode-extension#Backlinks for source files#Code to spec]]
it('lists the notes an active source file annotates, with the heading as written', async () => {
  const { idx } = await index();
  const r = backlinksFor(idx, 'src/auth.ts');
  expect(r.kind).toBe('source');
  expect(r.groups[0]!.items).toEqual([expect.objectContaining({ path: 'lat.md/architecture.md', target: 'architecture#Monorepo layout' })]);
});

// @lat: [[tests/vscode-extension#Backlinks#Spec to code]]
// @tg: verifies:: [[openspec:vscode-extension#Backlinks for source files#Spec to code]]
it('lists annotating source files for an active note, apart from note edges', async () => {
  const { idx } = await index();
  const r = backlinksFor(idx, 'lat.md/architecture.md');
  expect(r.groups.map((g) => g.title)).toEqual(['referenced from code']);
  expect(r.groups[0]!.items[0]).toMatchObject({ path: 'src/auth.ts', line: 1, target: 'architecture#Monorepo layout' });
});

// @lat: [[tests/vscode-extension#Backlinks#Empty states]]
// @tg: verifies:: [[openspec:vscode-extension#Empty and unsupported states#No edges]]
it('returns an empty result for files without edges, outside the roots or unknown', async () => {
  const { idx } = await index(['notes', 'lat.md', 'src']);
  expect(backlinksFor(idx, 'notes/Carol.md')).toEqual({ kind: 'empty', groups: [] });
  expect(backlinksFor(idx, 'src/plain.ts')).toEqual({ kind: 'empty', groups: [] });
  expect(backlinksFor(idx, 'docs/outside.md')).toEqual({ kind: 'empty', groups: [] });
  expect(backlinksFor(idx, 'nope.md')).toEqual({ kind: 'empty', groups: [] });
});

// @lat: [[tests/vscode-extension#Graph session#Expanded nodes survive refresh]]
// @tg: verifies:: [[openspec:graph-ui#Neighborhood view-state#Expanded nodes kept]]
it('keeps expanded neighborhoods across refreshes and drops removed nodes', async () => {
  const { dir, idx } = await index();
  const session = new GraphSession(() => idx.graph);
  const ids = (a: string | null) => session.elements(a).nodes.map((n) => n.id).sort();
  expect(ids('notes/Carol.md')).toEqual(['notes/Bob.md', 'notes/Carol.md']);
  session.expand('notes/Alice.md');
  expect(ids('notes/Carol.md')).toEqual(['notes/Alice.md', 'notes/Bob.md', 'notes/Carol.md', 'notes/Eve.md']);
  writeFileSync(join(dir, 'notes/Carol.md'), 'knows:: [[Eve]]\n');
  await idx.update('notes/Carol.md');
  expect(ids('notes/Carol.md')).toEqual(['notes/Alice.md', 'notes/Bob.md', 'notes/Carol.md', 'notes/Eve.md']);
  rmSync(join(dir, 'notes/Alice.md'));
  await idx.update('notes/Alice.md');
  expect(ids('notes/Carol.md')).not.toContain('notes/Alice.md');
});

// @lat: [[tests/vscode-extension#Backlinks#Outside the roots]]
// @tg: verifies:: [[openspec:vscode-extension#Empty and unsupported states#Outside the roots]]
it('says a file is outside the configured roots, apart from the no-edges message', async () => {
  const { idx } = await index(['docs']);
  expect(panelRows(idx, { path: 'src/main.ts', inWorkspace: true }, false)).toEqual([{ kind: 'message', text: 'main.ts is outside the configured roots (typegraph.roots).' }]);
  expect(panelRows(idx, { path: '/elsewhere/x.md', inWorkspace: false }, false)).toEqual([{ kind: 'message', text: 'x.md is outside the configured roots (typegraph.roots).' }]);
  expect(panelRows(idx, { path: 'docs/outside.md', inWorkspace: true }, false)).toEqual([{ kind: 'message', text: 'No typed edges for outside.md.' }]);
});

// @lat: [[tests/vscode-extension#Backlinks#Setup offer]]
// @tg: verifies:: [[openspec:vscode-extension#Set up TypeGraph#Value first]]
it('leaves the view empty for the welcome content and appends the setup offer to backlinks', async () => {
  const { idx } = await index();
  expect(panelRows(idx, null, true)).toEqual([]);
  expect(panelRows(idx, null, false)).toEqual([{ kind: 'message', text: 'Open a markdown or source file.' }]);
  const rows = panelRows(idx, { path: 'notes/Eve.md', inWorkspace: true }, true);
  expect(rows.map((r) => r.kind)).toEqual(['group', 'setup']);
  expect(panelRows(idx, { path: 'notes/Eve.md', inWorkspace: true }, false).map((r) => r.kind)).toEqual(['group']);
});

// @lat: [[tests/vscode-extension#Graph session#Expansions reset on file switch]]
// @tg: verifies:: [[openspec:vscode-extension#Graph webview#Expansions reset on file switch]]
it('clears expanded nodes when the active file changes and keeps the last file without one', async () => {
  const { idx } = await index();
  const session = new GraphSession(() => idx.graph);
  const ids = (a: string | null) => session.elements(a).nodes.map((n) => n.id).sort();
  expect(ids('notes/Carol.md')).toEqual(['notes/Bob.md', 'notes/Carol.md']);
  session.expand('notes/Alice.md');
  expect(ids(null)).toEqual(['notes/Alice.md', 'notes/Bob.md', 'notes/Carol.md', 'notes/Eve.md']);
  expect(ids('notes/Eve.md')).toEqual(['notes/Alice.md', 'notes/Eve.md']);
  expect(ids('notes/Carol.md')).toEqual(['notes/Bob.md', 'notes/Carol.md']);
});
