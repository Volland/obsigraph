import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';
import { LatIndex, leadingParagraphIssue, parseMarkdown } from '../src/latmd.js';

const idx = (files: Record<string, string>) => new LatIndex(Object.entries(files).map(([path, text]) => ({ path, text })));

// @lat: [[tests/lat-resolver#Section tree#Nested headings]]
// @tg: verifies:: [[openspec:lat-resolver#Section tree#Nested headings]]
it('nests sections by heading level', () => {
  const p = parseMarkdown('lat.md/a.md', '# A\n\nIntro.\n\n## B\n\nBody.\n\n### C\n\nDeep.\n');
  const c = p.flat.find((s) => s.heading === 'C')!;
  expect(c.id).toBe('lat.md/a#A#B#C');
  expect(p.roots[0]!.children[0]!.children[0]).toBe(c);
  expect(p.flat.map((s) => s.endLine)).toEqual([4, 8, 11]);
});

// @lat: [[tests/lat-resolver#Section tree#Heading in code fence]]
// @tg: verifies:: [[openspec:lat-resolver#Section tree#Heading in code fence]]
it('ignores headings and links inside fenced code', () => {
  const p = parseMarkdown('lat.md/a.md', '# A\n\nText.\n\n```md\n## Not a section\n[[nope]]\n```\n\nSee `[[inline]]` and [[real]].\n');
  expect(p.flat.map((s) => s.heading)).toEqual(['A']);
  expect(p.refs.map((r) => r.target)).toEqual(['real']);
});

// @lat: [[tests/lat-resolver#Section ids#Short id]]
// @tg: verifies:: [[openspec:lat-resolver#Section ids#Short id]]
it('resolves a short id when the file name is unique', () => {
  const i = idx({ 'lat.md/tests/search.md': '# Search\n\nx.\n\n## Indexing\n\nHow.\n' });
  const r = i.resolve('search#Indexing');
  expect(r).toMatchObject({ kind: 'section', id: 'lat.md/tests/search#Search#Indexing' });
  expect(i.resolve('lat.md/tests/search#Search#Indexing').kind).toBe('section');
  expect(i.resolve('SEARCH#indexing').kind).toBe('section');
});

// @lat: [[tests/lat-resolver#Section ids#Ambiguous short id]]
// @tg: verifies:: [[openspec:lat-resolver#Section ids#Ambiguous short id]]
it('reports ambiguity instead of guessing', () => {
  const i = idx({
    'lat.md/a/search.md': '# Search\n\nx.\n\n## Indexing\n\ny.\n',
    'lat.md/b/search.md': '# Search\n\nx.\n',
  });
  const r = i.resolve('search#Indexing');
  expect(r.kind).toBe('ambiguous');
  if (r.kind === 'ambiguous') {
    expect(r.candidates.sort()).toEqual(['lat.md/a/search#Indexing', 'lat.md/b/search#Indexing']);
    expect(r.suggested).toBe('lat.md/a/search#Indexing');
  }
});

// @lat: [[tests/lat-resolver#Link resolution#Code target]]
// @tg: verifies:: [[openspec:lat-resolver#Link resolution#Code target]]
it('resolves source links to code targets', () => {
  const i = idx({ 'lat.md/a.md': '# A\n\nSee [[src/config.ts#getConfigDir]] and [[src/x.mts#Foo#bar]].\n' });
  expect(i.resolve('src/config.ts#getConfigDir')).toEqual({ kind: 'code', file: 'src/config.ts', symbol: 'getConfigDir' });
  expect(i.resolve('src/x.mts#Foo#bar')).toEqual({ kind: 'code', file: 'src/x.mts', symbol: 'Foo#bar' });
});

// @lat: [[tests/lat-resolver#Link resolution#Missing section]]
// @tg: verifies:: [[openspec:lat-resolver#Link resolution#Missing section]]
it('reports a missing section with the closest suggestion', () => {
  const i = idx({ 'lat.md/a.md': '# A\n\nx.\n\n## Source of truth\n\ny.\n' });
  const r = i.resolve('a#Source of trut');
  expect(r).toMatchObject({ kind: 'missing', reason: 'no-section', suggestion: 'lat.md/a#A#Source of truth' });
  expect(i.resolve('notes/file.docx#x')).toMatchObject({ kind: 'missing', reason: 'unsupported-extension', ext: '.docx' });
});

// @lat: [[tests/lat-resolver#Leading paragraph rule#Missing leading paragraph]]
// @tg: verifies:: [[openspec:lat-resolver#Leading paragraph rule#Missing leading paragraph]]
it('flags a heading followed directly by a child heading', () => {
  const p = parseMarkdown('lat.md/a.md', '# A\n\n## B\n\nBody.\n');
  expect(leadingParagraphIssue(p.flat[0]!)).toEqual({ kind: 'missing' });
  expect(leadingParagraphIssue(p.flat[1]!)).toBeNull();
});

// @lat: [[tests/lat-resolver#Leading paragraph rule#Wiki links not counted]]
// @tg: verifies:: [[openspec:lat-resolver#Leading paragraph rule#Wiki links not counted]]
it('does not count wiki link content toward the 250 limit', () => {
  const long = `[[${'x'.repeat(100)}]]`;
  const text = `# A\n\n${'a'.repeat(240)} ${long}\n`;
  const p = parseMarkdown('lat.md/a.md', text);
  expect(leadingParagraphIssue(p.flat[0]!)).toBeNull();
  const over = parseMarkdown('lat.md/a.md', `# A\n\n${'a'.repeat(260)}\n`);
  expect(leadingParagraphIssue(over.flat[0]!)).toMatchObject({ kind: 'too-long', length: 260 });
});

// @lat: [[tests/lat-resolver#Link resolution#Real project resolves]]
it("resolves every section link in this repository's lat.md", () => {
  const root = join(import.meta.dirname, '..', '..', '..');
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? (n.startsWith('.') ? [] : walk(join(d, n))) : n.endsWith('.md') ? [join(d, n)] : []));
  const files = walk(join(root, 'lat.md')).map((f) => ({ path: relative(root, f), text: readFileSync(f, 'utf8') }));
  const i = new LatIndex(files);
  const bad = i.refs().filter((r) => {
    const res = i.resolve(r.target);
    return res.kind !== 'section' && res.kind !== 'code';
  });
  expect(bad.map((r) => `${r.file}:${r.line} ${r.target}`)).toEqual([]);
  expect(i.sections().every((s) => leadingParagraphIssue(s) === null)).toBe(true);
});
