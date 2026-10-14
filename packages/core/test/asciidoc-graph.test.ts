import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  chunkNote,
  EmbedIndex,
  exportOkf,
  Graph,
  noteFrontmatter,
  pathResolver,
  planNewNote,
  schemasFromGraph,
  validateVault,
  type NoteInput,
  type TypeSchema,
} from '../src/index.js';

const fixture = (p: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/asciidoc-book', p), 'utf8');

/** Notes as a host hands them over: `.adoc` metadata read through noteFrontmatter. */
function vault(notes: { path: string; text: string }[], options: ConstructorParameters<typeof Graph>[2] = {}) {
  const paths = notes.map((n) => n.path);
  const graph = new Graph(pathResolver(() => paths), undefined, { parseYaml, ...options });
  for (const n of notes) graph.upsertNote({ ...n, frontmatter: noteFrontmatter(n.path, n.text, parseYaml).frontmatter });
  return graph;
}

describe('asciidoc in the graph', () => {
  // @tg: verifies:: [[openspec:asciidoc-notes#AsciiDoc files are notes#Document title]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Graph#Node per file]]
  it('makes one node per file, id with extension, titled from the document title', () => {
    const g = vault([{ path: 'chapters/ch01.adoc', text: fixture('chapters/ch01.adoc') }, { path: 'parts/intro.adoc', text: 'Just text.' }]);
    expect(g.node('chapters/ch01.adoc')).toMatchObject({ stub: false, props: { title: 'Chapter 1. Metagraphs', path: 'chapters/ch01.adoc' } });
    expect(g.node('parts/intro.adoc')!.props.title).toBe('intro');
  });

  // @tg: verifies:: [[openspec:asciidoc-notes#Properties from a leading comment block#Typed chapter]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Graph#Labels and properties]]
  it('labels and properties come from the leading block, which wins over attributes', () => {
    const g = vault([{ path: 'chapters/ch01.adoc', text: fixture('chapters/ch01.adoc') }]);
    expect(g.node('chapters/ch01.adoc')).toMatchObject({ labels: ['Chapter'], props: { status: 'draft', pages: 12 } });
  });

  // @lat: [[tests/asciidoc-notes#Graph#Host hands no properties]]
  it('reads properties itself when the host hands none', () => {
    const g = new Graph(() => null);
    g.upsertNote({ path: 'a.adoc', text: '////\ntype: Chapter\n////\n= T\n' });
    expect(g.node('a.adoc')!.labels).toEqual(['Chapter']);
  });

  // @tg: verifies:: [[openspec:asciidoc-notes#Typed edges only in comments#Line comment]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Graph#Comment edges with section]]
  it('turns comment edges into graph edges with their section', () => {
    const g = vault([{ path: 'chapters/ch01.adoc', text: fixture('chapters/ch01.adoc') }]);
    const edges = g.outEdges('chapters/ch01.adoc');
    const defines = edges.find((e) => e.type === 'defines')!;
    expect(defines.target).toBe('Metagraph');
    expect(defines.props.section).toBe('chapters/ch01.adoc#Metagraphs');
    expect(defines.heading).toBe('Metagraphs');
    expect(edges.filter((e) => e.type === 'contrasts_with')).toMatchObject([{ sign: -1, target: 'Property graph' }]);
    // The trap lines inside the listing and example blocks make no edge, and the stub is not created.
    expect(g.node('Nothing')).toBeUndefined();
  });

  // @tg: verifies:: [[openspec:asciidoc-notes#Includes become ordered edges#Book assembly]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Graph#Book assembly]]
  it('links a book to its chapters in order', () => {
    const g = vault([
      { path: 'book.adoc', text: fixture('book.adoc') },
      { path: 'chapters/ch01.adoc', text: fixture('chapters/ch01.adoc') },
      { path: 'chapters/ch02.adoc', text: fixture('chapters/ch02.adoc') },
    ]);
    expect(g.outEdges('book.adoc').filter((e) => e.type === 'includes').map((e) => [e.target, e.props.order])).toEqual([
      ['chapters/ch01.adoc', 1],
      ['chapters/ch02.adoc', 2],
    ]);
  });

  // @tg: verifies:: [[openspec:asciidoc-notes#Native cross references become links#Relative xref]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Graph#Xref link edges]]
  it('adds links_to for xrefs only when link edges are on', () => {
    const notes = [
      { path: 'chapters/ch01.adoc', text: fixture('chapters/ch01.adoc') },
      { path: 'chapters/ch02.adoc', text: fixture('chapters/ch02.adoc') },
    ];
    expect(vault(notes).outEdges('chapters/ch01.adoc').some((e) => e.type === 'links_to')).toBe(false);
    const on = vault(notes, { linkEdges: true }).outEdges('chapters/ch01.adoc').filter((e) => e.type === 'links_to');
    expect(on.map((e) => e.target)).toEqual(['chapters/ch02.adoc']);
  });

  // @tg: verifies:: [[openspec:asciidoc-notes#Sections and id aliases#Generated id alias]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Graph#Section resolution]]
  it('resolves ids, heading paths and headings to canonical section ids', () => {
    const g = vault([{ path: 'chapters/ch01.adoc', text: fixture('chapters/ch01.adoc') }]);
    expect(g.resolveSection('chapters/ch01.adoc', '_typed_links')).toBe('chapters/ch01.adoc#Typed Links');
    expect(g.resolveSection('chapters/ch01.adoc', 'metagraphs')).toBe('chapters/ch01.adoc#Metagraphs');
    expect(g.resolveSection('chapters/ch01.adoc', 'Metagraphs#Definition')).toBe('chapters/ch01.adoc#Metagraphs#Definition');
    expect(g.resolveSection('chapters/ch01.adoc', 'nope')).toBeNull();
  });
});

describe('links across formats', () => {
  // @tg: verifies:: [[openspec:asciidoc-notes#Link resolution across formats#Markdown note links a chapter]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Cross-format links#Markdown links a chapter]]
  it('lets a Markdown note link a chapter by bare name', () => {
    const g = vault([
      { path: 'Concepts/Metagraph.md', text: 'appears_in:: [[ch03]]' },
      { path: 'book/ch03.adoc', text: '= Chapter 3\n' },
    ]);
    expect(g.outEdges('Concepts/Metagraph.md')[0]!.target).toBe('book/ch03.adoc');
  });

  describe('when both formats exist', () => {
    const notes = [
      { path: 'Metagraph.md', text: '# M' },
      { path: 'Metagraph.adoc', text: '= M' },
      { path: 'Other.md', text: 'see:: [[Metagraph]]\nexact:: [[Metagraph.adoc]]\nmd:: [[Metagraph.md]]' },
    ];

    // @tg: verifies:: [[openspec:asciidoc-notes#Link resolution across formats#Ambiguous target]] {level: integration}
    // @lat: [[tests/asciidoc-notes#Cross-format links#Ambiguous bare link]]
    it('reports a bare link as ambiguous and creates no edge to either file', () => {
      const g = vault(notes);
      const see = g.outEdges('Other.md').find((e) => e.type === 'see')!;
      expect(['Metagraph.md', 'Metagraph.adoc']).not.toContain(see.target);
      const found = validateVault(notes.map((n) => ({ ...n, frontmatter: null })), { parseYaml });
      expect(found.filter((f) => f.code === 'ambiguous-link')).toMatchObject([{ path: 'Other.md', line: 1 }]);
      expect(found.find((f) => f.code === 'ambiguous-link')!.message).toMatch(/Metagraph\.md and Metagraph\.adoc/);
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Link resolution across formats#Explicit extension]] {level: integration}
    // @lat: [[tests/asciidoc-notes#Cross-format links#Explicit extension]]
    it('resolves an explicit extension to that file only', () => {
      const g = vault(notes);
      const out = g.outEdges('Other.md');
      expect(out.find((e) => e.type === 'exact')!.target).toBe('Metagraph.adoc');
      expect(out.find((e) => e.type === 'md')!.target).toBe('Metagraph.md');
    });
  });
});

describe('asciidoc visible text and limits', () => {
  // @tg: verifies:: [[openspec:chunking-verbalization#AsciiDoc chunks hold visible text#Metadata stripped]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Chunking and limits#Chunks by section]]
  it('chunks by section with the section heading path and context from the properties', () => {
    const text = fixture('chapters/ch01.adoc');
    const chunks = chunkNote({ path: 'chapters/ch01.adoc', text, frontmatter: noteFrontmatter('chapters/ch01.adoc', text, parseYaml).frontmatter, labels: ['Chapter'] });
    const defn = chunks.find((c) => c.headingPath.join('#') === 'Metagraphs#Definition')!;
    expect(defn.body).toBe('The definition lives here.');
    expect(defn.text).toContain('Chapter 1. Metagraphs (Chapter)');
    expect(defn.text).toContain('status: draft');
    for (const c of chunks.filter((c) => c.headingPath[0] !== 'Aside' && !c.body.includes('Fake heading'))) expect(c.body).not.toMatch(/@tg|:tg-|include::|^\[#/m);
  });

  // @tg: verifies:: [[openspec:chunking-verbalization#AsciiDoc chunks hold visible text#Cross reference text]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Chunking and limits#Cross reference text in chunks]]
  it('keeps the text of cross references', () => {
    const chunks = chunkNote({ path: 'a.adoc', text: '= T\n\nGo to xref:ch04.adoc[the next chapter] or <<x,there>>.' });
    expect(chunks[0]!.body).toBe('Go to the next chapter or there.');
  });

  // @tg: verifies:: [[openspec:chunking-verbalization#AsciiDoc chunks hold visible text#Included files not duplicated]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Chunking and limits#Includes not duplicated]]
  it('does not copy included files into the including note', () => {
    const chunks = chunkNote({ path: 'book.adoc', text: fixture('book.adoc') });
    expect(chunks.map((c) => c.body).join('\n')).not.toContain('Intro paragraph');
  });

  // @tg: verifies:: [[openspec:asciidoc-notes#AsciiDoc limits in this version#AsciiDoc schema ignored]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Chunking and limits#AsciiDoc schema ignored]]
  it('reads no schema from an AsciiDoc file in the schema folder', () => {
    const g = vault([{ path: 'Types/Chapter.adoc', text: '////\nschema:\n  properties:\n    status: {kind: text}\n////\n= Chapter\n' }]);
    expect(g.node('Types/Chapter.adoc')).toBeDefined();
    expect(schemasFromGraph(g, 'Types/').schemas.size).toBe(0);
  });

  // @lat: [[tests/asciidoc-notes#Chunking and limits#No edge embeds]]
  it('does not scan AsciiDoc notes for edge embeds', () => {
    const idx = new EmbedIndex();
    idx.upsert('a.adoc', '{{edge: A -knows-> B}}');
    idx.upsert('a.md', '{{edge: A -knows-> B}}');
    expect(idx.warnings(new Graph(() => null)).length).toBe(0);
    expect(JSON.stringify([...(idx as unknown as { byPath: Map<string, unknown> }).byPath.keys()])).toBe('["a.md"]');
  });
});

describe('OKF export with AsciiDoc notes', () => {
  const notes = [
    { path: 'book/ch03.adoc', text: '////\ntype: Chapter\n////\n= Chapter 3\n', frontmatter: { type: 'Chapter' } },
    { path: 'Concepts/Metagraph.md', text: '---\ntype: Concept\n---\nappears_in:: [[ch03]]\n\nSee [[ch03|the chapter]].', frontmatter: { type: 'Concept' } },
  ];

  // @tg: verifies:: [[openspec:okf-compat#AsciiDoc notes skipped in OKF export#Chapter skipped]] {level: integration}
  // @lat: [[tests/asciidoc-notes#OKF export#Chapters skipped]]
  it('leaves chapters out of the bundle and lists them as skipped', () => {
    const { files, report } = exportOkf(notes);
    expect(files.map((f) => f.path)).toContain('Concepts/Metagraph.md');
    expect(files.map((f) => f.path)).not.toContain('book/ch03.adoc');
    expect(report.find((r) => r.kind === 'skipped-asciidoc')).toMatchObject({ count: 1, examples: ['book/ch03.adoc'] });
  });

  // @tg: verifies:: [[openspec:okf-compat#AsciiDoc notes skipped in OKF export#Link to a chapter]] {level: integration}
  // @lat: [[tests/asciidoc-notes#OKF export#Links to chapters as text]]
  it('writes links to a chapter as plain text and counts them', () => {
    const { files, report } = exportOkf(notes);
    const text = files.find((f) => f.path === 'Concepts/Metagraph.md')!.text;
    expect(text).toContain('appears_in:: ch03');
    expect(text).toContain('See the chapter.');
    expect(text).not.toContain('](/book/ch03');
    expect(report.find((r) => r.kind === 'asciidoc-link')!.count).toBe(2);
  });
});

describe('new AsciiDoc notes', () => {
  const schema = {
    type: 'Chapter',
    properties: [
      { name: 'status', kind: 'text', default: 'draft', many: false },
      { name: 'pages', kind: 'number', default: null, many: false },
    ],
    ids: [],
    edges: null,
  } as unknown as TypeSchema;
  const base = { schema, title: 'Reification', schemaBody: '', graph: new Graph(() => null), now: new Date('2026-10-14T10:00:00Z') };
  const template = '= {{title}}\n:tg-status:\n:tg-pages:\n\n== Notes\n';

  // @tg: verifies:: [[openspec:asciidoc-notes#AsciiDoc limits in this version#Template decides format]] {level: integration}
  // @lat: [[tests/asciidoc-notes#New notes#Template decides the format]]
  it('creates an .adoc file with the leading block and attributes filled when the template is .adoc', () => {
    const plan = planNewNote({ ...base, linkedBody: template, templatePath: 'Templates/Chapter.adoc' });
    expect(plan.fileName).toBe('Reification.adoc');
    expect(plan.content.startsWith('////\ntype: Chapter\nstatus: draft\n////\n= Reification\n')).toBe(true);
    expect(plan.content).toContain(':tg-status: draft\n');
    expect(plan.content).toContain(':tg-pages:\n');
    expect(noteFrontmatter('Reification.adoc', plan.content, parseYaml).frontmatter).toMatchObject({ type: 'Chapter', status: 'draft' });
  });

  // @lat: [[tests/asciidoc-notes#New notes#Markdown template unchanged]]
  it('still creates Markdown for a Markdown template', () => {
    const plan = planNewNote({ ...base, linkedBody: '## Notes', templatePath: 'Templates/Chapter.md' });
    expect(plan.fileName).toBe('Reification.md');
    expect(plan.content.startsWith('---\n')).toBe(true);
  });

  // @lat: [[tests/asciidoc-notes#New notes#Template values win]]
  it('keeps the template values over defaults', () => {
    const plan = planNewNote({ ...base, linkedBody: '////\nstatus: final\n////\n= {{title}}\n', templatePath: 'T.adoc' });
    expect(plan.content).toContain('status: final');
  });
});

describe('unused helper types', () => {
  it('keeps NoteInput exported', () => {
    const n: NoteInput = { path: 'a.adoc', text: '' };
    expect(n.path).toBe('a.adoc');
  });
});
