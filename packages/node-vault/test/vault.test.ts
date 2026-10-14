import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { isNotePath, listMarkdown, listNotes, readNote } from '../src/index';

function vault(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'nv-'));
  for (const [rel, text] of Object.entries(files)) {
    const full = join(dir, ...rel.split('/'));
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  }
  return dir;
}

// @tg: verifies:: [[tests/node-vault#Skips dot and ignored folders]] {since: "2026-10-04", level: unit}
// @lat: [[tests/node-vault#Skips dot and ignored folders]]
// @tg: verifies:: [[openspec:node-vault-loader#List markdown files#Dot folders skipped]]
// @tg: verifies:: [[openspec:node-vault-loader#List markdown files#Ignore list honored]]
it('lists markdown sorted, skipping dot folders and ignored names', async () => {
  const dir = vault({
    'b.md': '',
    'a.md': '',
    '.obsidian/x.md': '',
    '.trash/y.md': '',
    'node_modules/pkg/README.md': '',
    'docs/n.md': '',
    'docs/readme.txt': '',
  });
  expect((await listMarkdown(dir)).map((f) => f.path)).toEqual(['a.md', 'b.md', 'docs/n.md', 'node_modules/pkg/README.md']);
  expect((await listMarkdown(dir, { ignore: ['node_modules'] })).map((f) => f.path)).toEqual(['a.md', 'b.md', 'docs/n.md']);
  expect(isNotePath('node_modules/p/R.md', ['node_modules'])).toBe(false);
  expect(isNotePath('docs/n.md', ['node_modules'])).toBe(true);
});

// @tg: verifies:: [[tests/node-vault#Reads frontmatter read-only]] {since: "2026-10-04", level: unit}
// @lat: [[tests/node-vault#Reads frontmatter read-only]]
// @tg: verifies:: [[openspec:node-vault-loader#Read a note read-only#Valid frontmatter]]
it('reads text, frontmatter and hash without touching the file', async () => {
  const dir = vault({ 'p.md': '---\ntype: Person\n---\nknows:: [[Bob]]\n' });
  const before = statSync(join(dir, 'p.md')).mtimeMs;
  const r = await readNote(dir, 'p.md');
  expect(r.note.frontmatter).toEqual({ type: 'Person' });
  expect(r.frontmatterError).toBeNull();
  expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(statSync(join(dir, 'p.md')).mtimeMs).toBe(before);
  expect(readFileSync(join(dir, 'p.md'), 'utf8')).toBe(r.note.text);
});

// @tg: verifies:: [[tests/node-vault#Reports broken frontmatter]] {since: "2026-10-04", level: unit}
// @lat: [[tests/node-vault#Reports broken frontmatter]]
// @tg: verifies:: [[openspec:node-vault-loader#Read a note read-only#Broken frontmatter]]
it('keeps the text and reports a one-line error for invalid YAML', async () => {
  const dir = vault({ 'p.md': '---\ntype: [unclosed\n---\nbody\n' });
  const r = await readNote(dir, 'p.md');
  expect(r.note.frontmatter).toBeNull();
  expect(r.frontmatterError).toMatch(/\S/);
  expect(r.frontmatterError).not.toContain('\n');
  expect(r.note.text).toContain('body');
});

// @tg: verifies:: [[openspec:node-vault-loader#List markdown files#AsciiDoc listed]] {level: unit}
// @lat: [[tests/asciidoc-notes#Hosts#Node vault lists notes]]
it('lists AsciiDoc notes beside Markdown unless turned off', async () => {
  const dir = vault({ 'a.md': '', 'book/ch01.adoc': '', 'book/notes.txt': '', '.obsidian/x.adoc': '' });
  expect((await listNotes(dir)).map((f) => f.path)).toEqual(['a.md', 'book/ch01.adoc']);
  expect((await listNotes(dir, { asciidoc: false })).map((f) => f.path)).toEqual(['a.md']);
  expect((await listMarkdown(dir)).map((f) => f.path)).toEqual(['a.md']);
  expect(isNotePath('book/ch01.adoc')).toBe(true);
  expect(isNotePath('book/ch01.adoc', [], false)).toBe(false);
  expect(isNotePath('.obsidian/x.adoc')).toBe(false);
});

// @tg: verifies:: [[openspec:node-vault-loader#Read a note read-only#AsciiDoc metadata]] {level: unit}
// @lat: [[tests/asciidoc-notes#Hosts#Node vault reads properties]]
it('reads the merged properties of an AsciiDoc note', async () => {
  const text = '////\ntype: Chapter\n////\n= Metagraphs\n:tg-status: draft\n\nBody.\n';
  const dir = vault({ 'ch.adoc': text });
  const r = await readNote(dir, 'ch.adoc');
  expect(r.note.frontmatter).toEqual({ type: 'Chapter', status: 'draft' });
  expect(r.frontmatterError).toBeNull();
  expect(r.note.text).toBe(text);
});

// @tg: verifies:: [[openspec:node-vault-loader#Read a note read-only#Broken frontmatter]] {level: unit}
// @lat: [[tests/asciidoc-notes#Hosts#Node vault block error]]
it('reports a leading AsciiDoc block that is not YAML as a one-line error', async () => {
  const dir = vault({ 'ch.adoc': '////\nCopyright 2024 Someone\n////\n= T\n' });
  const r = await readNote(dir, 'ch.adoc');
  expect(r.note.frontmatter).toBeNull();
  expect(r.frontmatterError).toMatch(/\S/);
  expect(r.frontmatterError).not.toContain('\n');
});
