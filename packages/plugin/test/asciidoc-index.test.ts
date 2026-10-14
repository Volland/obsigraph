import { pathResolver } from '@obsigraph/core';
import type { App } from 'obsidian';
import { afterEach, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { VaultIndex } from '../src/vault-index';

// Built from parts so the repository's own scanner does not read these fixtures as annotations.
const TG = '@' + 'tg';

vi.mock('obsidian', () => ({ TFile: class TFile {} }));
const { TFile } = await import('obsidian');

type Handler = (...args: unknown[]) => unknown;

/** An in-memory Obsidian app. Like Obsidian, its metadata cache resolves bare names to Markdown and `.adoc` only by extension. */
function app(files: Record<string, string>) {
  const mk = (path: string) => Object.assign(new TFile(), { path, extension: path.slice(path.lastIndexOf('.') + 1) });
  const handlers = new Map<string, Handler>();
  const state = { files: { ...files } };
  const list = () => Object.keys(state.files).map(mk);
  const resolve = pathResolver(() => Object.keys(state.files));
  const vault = {
    getMarkdownFiles: () => list().filter((f) => f.extension === 'md'),
    getFiles: () => list(),
    cachedRead: async (f: { path: string }) => state.files[f.path] ?? '',
    on: (name: string, fn: Handler) => {
      handlers.set(name, fn);
      return {};
    },
  };
  const metadataCache = {
    getFirstLinkpathDest: (link: string, source: string) => {
      const withExt = /\.[a-z]+$/i.test(link) ? link : `${link}.md`;
      const hit = resolve(withExt, source);
      return hit ? mk(hit) : null;
    },
    getFileCache: (f: { path: string }) => ({ frontmatter: f.path.endsWith('.md') && state.files[f.path]!.startsWith('---') ? { type: 'Concept' } : undefined }),
    on: (name: string, fn: Handler) => {
      handlers.set(`mc:${name}`, fn);
      return {};
    },
  };
  return { app: { vault, metadataCache } as unknown as App, state, handlers, mk };
}

const FILES = {
  'Concepts/Metagraph.md': 'appears_in:: [[ch03]]\nalso:: [[Both]]\nexact:: [[Both.adoc]]\n',
  'book/ch03.adoc': '////\ntype: Chapter\n////\n= Metagraphs\n\n// ' + TG + ': defines:: [[Metagraph]]\n',
  'Both.md': '# b',
  'Both.adoc': '= b',
};

const indexOf = (a: App, on = true) => new VaultIndex(a, () => 0, () => 'Types/', () => ({ nodes: {}, edges: {} }), () => true, undefined, undefined, undefined, undefined, () => on, parseYaml);

afterEach(() => vi.unstubAllGlobals());

// @tg: verifies:: [[openspec:asciidoc-notes#Hosts index AsciiDoc notes#Obsidian graph]] {level: integration}
// @lat: [[tests/asciidoc-notes#Hosts#Obsidian indexes notes]]
it('indexes .adoc notes read through the vault, with labels from the leading block', async () => {
  vi.stubGlobal('window', globalThis);
  const { app: a } = app(FILES);
  const index = indexOf(a);
  await index.build();
  expect(index.graph.node('book/ch03.adoc')).toMatchObject({ labels: ['Chapter'], props: { title: 'Metagraphs' } });
  const r = index.engine.run('MATCH (c:Chapter) RETURN c.title');
  expect(r.rows).toEqual([['Metagraphs']]);
  index.destroy();
});

// @tg: verifies:: [[openspec:asciidoc-notes#Link resolution across formats#Markdown note links a chapter]] {level: integration}
// @tg: verifies:: [[openspec:asciidoc-notes#Link resolution across formats#Ambiguous target]] {level: integration}
// @tg: verifies:: [[openspec:asciidoc-notes#Link resolution across formats#Explicit extension]] {level: integration}
// @lat: [[tests/asciidoc-notes#Hosts#Obsidian resolves across formats]]
it('resolves a bare link to a chapter, reports a bare link matching both formats and honors an explicit extension', async () => {
  vi.stubGlobal('window', globalThis);
  const index = indexOf(app(FILES).app);
  await index.build();
  const out = index.graph.outEdges('Concepts/Metagraph.md');
  expect(out.find((e) => e.type === 'appears_in')!.target).toBe('book/ch03.adoc');
  expect(['Both.md', 'Both.adoc']).not.toContain(out.find((e) => e.type === 'also')!.target);
  expect(out.find((e) => e.type === 'exact')!.target).toBe('Both.adoc');
  expect(index.diagnostics().filter((d) => d.code === 'ambiguous-link')).toMatchObject([{ path: 'Concepts/Metagraph.md', line: 1 }]);
  index.destroy();
});

// @tg: verifies:: [[openspec:asciidoc-notes#Hosts index AsciiDoc notes#Setting off]] {level: integration}
// @lat: [[tests/asciidoc-notes#Hosts#Obsidian setting off]]
it('leaves .adoc files out when the setting is off and drops them on reindex', async () => {
  vi.stubGlobal('window', globalThis);
  const { app: a } = app(FILES);
  let on = true;
  const index = new VaultIndex(a, () => 0, () => 'Types/', () => ({ nodes: {}, edges: {} }), () => true, undefined, undefined, undefined, undefined, () => on, parseYaml);
  await index.build();
  expect(index.graph.node('book/ch03.adoc')).toBeDefined();
  on = false;
  await index.reindex();
  expect(index.graph.node('book/ch03.adoc')?.stub).not.toBe(false);
  expect(index.engine.run('MATCH (c:Chapter) RETURN c').rows).toEqual([]);
  index.destroy();

  const off = indexOf(a, false);
  await off.build();
  expect([...off.graph.nodes()].filter((n) => !n.stub).map((n) => n.id)).toEqual(['Concepts/Metagraph.md', 'Both.md']);
  off.destroy();
});

// @lat: [[tests/asciidoc-notes#Hosts#Obsidian vault events]]
it('re-reads an edited .adoc note, which has no metadata cache event, and handles delete and rename', async () => {
  vi.stubGlobal('window', globalThis);
  try {
    const { app: a, state, handlers, mk } = app(FILES);
    const index = indexOf(a);
    await index.build();
    vi.useFakeTimers();
    index.watch();
    state.files['book/ch03.adoc'] = '= Metagraphs\n\n// ' + TG + ': cites:: [[Metagraph]]\n';
    handlers.get('modify')!(mk('book/ch03.adoc'));
    await vi.advanceTimersByTimeAsync(300);
    expect(index.graph.outEdges('book/ch03.adoc').map((e) => e.type)).toEqual(['cites']);

    state.files['book/ch04.adoc'] = state.files['book/ch03.adoc']!;
    delete state.files['book/ch03.adoc'];
    await handlers.get('rename')!(mk('book/ch04.adoc'), 'book/ch03.adoc');
    expect(index.graph.node('book/ch03.adoc')?.stub).not.toBe(false);
    expect(index.graph.node('book/ch04.adoc')?.stub).toBe(false);
    handlers.get('delete')!(mk('book/ch04.adoc'));
    expect(index.graph.node('book/ch04.adoc')).toBeUndefined();
    index.destroy();
  } finally {
    vi.useRealTimers();
  }
});
