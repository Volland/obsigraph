import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { splitFrontmatter } from '@obsigraph/core';
import type { App } from 'obsidian';
import { expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { VaultIndex } from '../src/vault-index';

vi.mock('obsidian', () => ({ TFile: class TFile {} }));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
}

/** An Obsidian app over a real folder that can only read; any write fails the test. */
function readOnlyApp(root: string): App {
  const md = () => files(root).filter((f) => f.endsWith('.md')).map((f) => ({ path: relative(root, f).split('\\').join('/'), extension: 'md' }));
  const deny = () => {
    throw new Error('the index wrote to the vault');
  };
  const vault = {
    getMarkdownFiles: md,
    getFiles: md,
    cachedRead: async (f: { path: string }) => readFileSync(join(root, f.path), 'utf8'),
    read: async (f: { path: string }) => readFileSync(join(root, f.path), 'utf8'),
    modify: deny,
    process: deny,
    create: deny,
    append: deny,
    delete: deny,
    rename: deny,
  };
  const metadataCache = {
    getFirstLinkpathDest: () => null,
    getFileCache: (f: { path: string }) => {
      const { yaml } = splitFrontmatter(readFileSync(join(root, f.path), 'utf8'));
      return { frontmatter: yaml ? (parseYaml(yaml) as Record<string, unknown>) : undefined };
    },
  };
  return { vault, metadataCache } as unknown as App;
}

// @lat: [[tests/tg-vault#Read in place#Indexing leaves files untouched]]
// @tg: verifies:: [[openspec:lat-vault-integration#Read in place#Nested heading link]]
it('indexes in-vault lat.md folders without changing a byte', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tg-lat-vault-'));
  const put = (p: string, t: string) => {
    mkdirSync(join(root, p, '..'), { recursive: true });
    writeFileSync(join(root, p), t);
  };
  put('lat.md/lat.md', '# Lat\n\nIndex.\n\n- [[architecture]] — a\n');
  put('lat.md/architecture.md', '---\ntags: [docs]\n---\n# Architecture\n\nOverview, see [[src/config.ts#getConfigDir]].\r\n\n## Monorepo layout\n\nPackages.\n\n### core\n\nThe core package.\n');
  put('docs/lat.md/lat.md', '# Docs\n\nNested index without a trailing newline.');
  put('Notes/Alice.md', 'knows:: [[architecture#Monorepo layout#core]]\n');
  const before = new Map(files(root).map((f) => [f, readFileSync(f)]));

  vi.stubGlobal('window', globalThis);
  const index = new VaultIndex(readOnlyApp(root), () => 0, () => 'Types/', () => ({ nodes: {}, edges: {} }), () => true);
  await index.build();
  index.diagnostics();
  index.destroy();
  vi.unstubAllGlobals();

  expect(index.ready).toBe(true);
  expect(index.lat.section('lat.md/architecture#Architecture#Monorepo layout#core')).toBeTruthy();
  expect(index.lat.section('docs/lat.md/lat#Docs')).toBeTruthy();
  const after = files(root);
  expect(after.sort()).toEqual([...before.keys()].sort());
  for (const f of after) expect(readFileSync(f).equals(before.get(f)!), f).toBe(true);
});
