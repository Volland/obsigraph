import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathResolver, splitFrontmatter, toFindings } from '@obsigraph/core';
import type { App } from 'obsidian';
import { expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { run } from '../../cli/src/cli.mjs';
import '../../cli/src/commands/validate.mjs';
import { VaultIndex } from '../src/vault-index';

vi.mock('obsidian', () => ({ TFile: class TFile {} }));

const ROOT = join(__dirname, '../../../example');

function markdown(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.name.startsWith('.') ? [] : e.isDirectory() ? markdown(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  );
}

/** A read-only Obsidian app over the example vault, resolving links like the metadata cache. */
function app(): App {
  const paths = markdown(ROOT).map((f) => relative(ROOT, f).split('\\').join('/'));
  const resolve = pathResolver(() => paths);
  const file = (path: string) => ({ path, extension: 'md' });
  const vault = { getMarkdownFiles: () => paths.map(file), getFiles: () => paths.map(file), cachedRead: async (f: { path: string }) => readFileSync(join(ROOT, f.path), 'utf8') };
  const metadataCache = {
    getFirstLinkpathDest: (link: string, source: string) => {
      const p = resolve(link, source);
      return p ? file(p) : null;
    },
    getFileCache: (f: { path: string }) => {
      const { yaml } = splitFrontmatter(readFileSync(join(ROOT, f.path), 'utf8'));
      return { frontmatter: yaml ? (parseYaml(yaml) as Record<string, unknown>) : undefined };
    },
  };
  return { vault, metadataCache } as unknown as App;
}

// @lat: [[tests/tg-validate#Plugin and command agree]]
// @tg: verifies:: [[openspec:tg-validate#Same findings as the plugin#Plugin and command agree]]
it('gives the same findings for the example vault through tg validate and the plugin', async () => {
  vi.stubGlobal('window', globalThis);
  const index = new VaultIndex(app(), () => 0, () => 'Types/', () => ({ nodes: {}, edges: {} }), () => true);
  await index.build();
  const plugin = toFindings(index.diagnostics().filter((d) => d.code !== 'lat-link'));
  index.destroy();
  vi.unstubAllGlobals();

  let out = '';
  const code = await run(['validate', '--json', '--vault', ROOT], { cwd: ROOT, out: (t) => (out += t), err: () => {}, env: {} });
  const command = (JSON.parse(out) as { findings: unknown[] }).findings;
  expect(code).toBe(0);
  expect(command.length).toBeGreaterThan(0);
  expect(command).toEqual(plugin);
});
