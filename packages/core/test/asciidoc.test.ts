import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { noteFormat, noteFrontmatter, parseAsciidoc, scanLines } from '../src/index.js';

// Built from parts so the repository's own scanner does not read these fixtures as annotations.
const TG = '@' + 'tg';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (p: string) => readFileSync(join(here, 'fixtures/asciidoc-book', p), 'utf8');
const parse = (text: string, path = 'book/ch03.adoc') => parseAsciidoc(text, path, { parseYaml, linkEdges: true });

describe('asciidoc scanner', () => {
  // @lat: [[tests/asciidoc-notes#Parser#Delimiter stack]]
  it('only closes a block with the delimiter that opened it', () => {
    const kinds = scanLines(['----', '====', '== X', '----', '== Y']).map((l) => l.kind);
    expect(kinds).toEqual(['delim', 'content', 'content', 'delim', 'title']);
  });
});

describe('asciidoc notes', () => {
  // @tg: verifies:: [[openspec:asciidoc-notes#AsciiDoc files are notes#Document title]] {level: unit}
  // @lat: [[tests/asciidoc-notes#Parser#Document title]]
  it('takes the title from the document title', () => {
    expect(parse('= Chapter 3. Metagraphs\n\ntext').title).toBe('Chapter 3. Metagraphs');
  });

  // @tg: verifies:: [[openspec:asciidoc-notes#AsciiDoc files are notes#Partial without title]] {level: unit}
  it('has no title for a partial, leaving the file name to the graph', () => {
    expect(parse('Just text.', 'book/parts/intro.adoc').title).toBeNull();
    expect(noteFormat('book/parts/intro.adoc')).toBe('adoc');
  });

  describe('properties', () => {
    // @tg: verifies:: [[openspec:asciidoc-notes#Properties from a leading comment block#Typed chapter]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Leading property block]]
    it('reads a leading comment block as YAML', () => {
      const r = parse('////\ntype: Chapter\nstatus: draft\n////\n= Metagraphs\n');
      expect(r.meta).toMatchObject({ type: 'Chapter', status: 'draft' });
      expect(r.title).toBe('Metagraphs');
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Properties from a leading comment block#Optional YAML fences]] {level: unit}
    it('accepts --- fences inside the block', () => {
      expect(parse('////\n---\ntype: Chapter\n---\n////\n= T\n').meta).toEqual({ type: 'Chapter' });
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Properties from a leading comment block#Later block ignored]] {level: unit}
    it('ignores a property block after the title', () => {
      const r = parse('= T\n\n////\ntype: Chapter\n////\n');
      expect(r.meta).toBeNull();
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Properties from a leading comment block#Typed chapter]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Block that is not YAML]]
    it('reports a licence banner as a YAML error with no properties', () => {
      const r = parse('////\nCopyright 2024 Someone\n////\n= T\n', 'a.adoc');
      expect(r.meta).toBeNull();
      expect(r.metaError).toMatch(/not a YAML mapping|key: value/);
      expect(r.warnings.map((w) => w.code)).toContain('frontmatter-yaml');
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Properties from tg attributes#Typed attribute values]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Header attributes]]
    it('parses :tg- attributes as one-line YAML', () => {
      const r = parse('= T\n:tg-pages: 12\n:tg-concepts: [Metagraph, Reification]\n');
      expect(r.meta).toEqual({ pages: 12, concepts: ['Metagraph', 'Reification'] });
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Properties from tg attributes#Render attributes ignored]] {level: unit}
    it('ignores attributes without the tg- prefix', () => {
      expect(parse('= T\n:toc:\n:imagesdir: img\n').meta).toBeNull();
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Properties from tg attributes#Conflict]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Block wins over attributes]]
    it('lets the block win and reports the conflicting key', () => {
      const r = parse('////\nstatus: draft\n////\n= T\n:tg-status: final\n');
      expect(r.meta).toEqual({ status: 'draft' });
      expect(r.conflicts).toEqual(['status']);
      expect(r.warnings.map((w) => w.code)).toContain('adoc-meta-conflict');
    });

    // @lat: [[tests/asciidoc-notes#Parser#Host without a YAML parser]]
    it('works with the built-in flat reader when the host has no YAML parser', () => {
      const r = parseAsciidoc('////\ntype: Chapter\ntags:\n  - a\n  - b\n////\n= T\n:tg-n: 3\n', 'a.adoc');
      expect(r.meta).toEqual({ type: 'Chapter', tags: ['a', 'b'], n: 3 });
    });

    it('wraps both forms for hosts through noteFrontmatter', () => {
      expect(noteFrontmatter('a.adoc', '= T\n:tg-status: draft\n', parseYaml).frontmatter).toEqual({ status: 'draft' });
      expect(noteFrontmatter('a.md', '---\ntype: X\n---\nbody', parseYaml).frontmatter).toEqual({ type: 'X' });
    });
  });

  describe('typed edges', () => {
    // @tg: verifies:: [[openspec:asciidoc-notes#Typed edges only in comments#Line comment]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Line comment edge]]
    it('reads a line comment edge', () => {
      const r = parse('= T\n\n// ' + TG + ': cites:: [[Pavlyshyn 2024]] {page: 12}\n');
      expect(r.edges).toMatchObject([{ type: 'cites', target: 'Pavlyshyn 2024', props: { page: 12 } }]);
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Typed edges only in comments#Edge block]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Edge comment block]]
    it('reads an @tg comment block with signed edges', () => {
      const r = parse('= T\n\n////\n@tg\nextends:: [[Hypergraph]]\n-contrasts_with:: [[Property graph]]\n////\n');
      expect(r.edges.map((e) => [e.type, e.sign, e.target])).toEqual([
        ['extends', 1, 'Hypergraph'],
        ['contrasts_with', -1, 'Property graph'],
      ]);
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Typed edges only in comments#Visible edge syntax ignored]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Visible edge syntax]]
    it('ignores visible edge syntax and warns', () => {
      const r = parse('= T\n\ndefines:: [[Metagraph]]\n');
      expect(r.edges).toEqual([]);
      expect(r.warnings.map((w) => w.code)).toContain('adoc-visible-edge');
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Typed edges only in comments#Inside a delimited block]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Comment inside a verbatim block]]
    it('ignores comments inside a listing block', () => {
      const r = parse('= T\n\n----\n// ' + TG + ': defines:: [[X]]\n----\n');
      expect(r.edges).toEqual([]);
    });
  });

  describe('anchoring', () => {
    // @tg: verifies:: [[openspec:asciidoc-notes#Comment anchoring to sections#Comment above a heading]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Anchor to the next heading]]
    it('attaches a comment above a heading to that heading, across anchors and attributes', () => {
      const r = parse('= T\n\n// ' + TG + ': defines:: [[Metagraph]]\n[#metagraphs]\n== Metagraphs\n');
      expect(r.edges[0]!.props.section).toBe('book/ch03.adoc#Metagraphs');
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Comment anchoring to sections#Comment in a section body]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Anchor to the enclosing section]]
    it('attaches a body comment to the enclosing section', () => {
      const r = parse('== Hypergraphs\n\nBefore.\n\n// ' + TG + ': extends:: [[Graph]]\n\nAfter.\n\n== Next\n');
      expect(r.edges[0]!.props.section).toBe('book/ch03.adoc#Hypergraphs');
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Comment anchoring to sections#Comment in the preamble]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Preamble comment]]
    it('gives a preamble comment no section', () => {
      const r = parse('= T\n\nIntro.\n\n// ' + TG + ': cites:: [[X]]\n\nMore intro.\n\n== First\n');
      expect(r.edges[0]!.props).not.toHaveProperty('section');
    });
  });

  describe('sections', () => {
    const r = parse(fixture('chapters/ch01.adoc'), 'chapters/ch01.adoc');

    // @tg: verifies:: [[openspec:asciidoc-notes#Sections and id aliases#Heading path]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Heading-path ids]]
    it('builds heading-path ids', () => {
      expect(r.sections.map((s) => s.id)).toContain('chapters/ch01.adoc#Metagraphs#Definition');
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Sections and id aliases#Explicit id alias]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Explicit id aliases]]
    it('records explicit ids as aliases', () => {
      expect(r.sections.find((s) => s.heading === 'Metagraphs')!.aliases).toEqual(['metagraphs']);
      expect(r.sections.find((s) => s.heading === 'Hypergraphs')!.aliases).toEqual(['hyper-def']);
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Sections and id aliases#Generated id alias]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Generated ids]]
    it('generates ids as Asciidoctor does', () => {
      expect(r.sections.find((s) => s.heading === 'Typed Links')!.aliases).toEqual(['_typed_links']);
      const dup = parse(fixture('chapters/ch02.adoc'), 'chapters/ch02.adoc');
      expect(dup.sections.filter((s) => s.heading === 'Typed Links').map((s) => s.aliases[0])).toEqual(['_typed_links', '_typed_links_2']);
    });

    it('honors idprefix, idseparator and sectids', () => {
      expect(parse('= T\n:idprefix:\n:idseparator: -\n\n== Typed Links\n').sections[0]!.aliases).toEqual(['typed-links']);
      expect(parse('= T\n:sectids!:\n\n== Typed Links\n').sections[0]!.aliases).toEqual([]);
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Sections and id aliases#Discrete heading]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Discrete and block headings]]
    it('skips discrete headings and headings inside blocks', () => {
      const headings = r.sections.map((s) => s.heading);
      expect(headings).not.toContain('Aside');
      expect(headings).not.toContain('Fake heading');
      expect(headings).not.toContain('Also not a section');
    });
  });

  describe('references', () => {
    // @tg: verifies:: [[openspec:asciidoc-notes#Native cross references become links#Relative xref]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Relative xref]]
    it('resolves an xref relative to the file', () => {
      const r = parse('See xref:ch04.adoc[next chapter].', 'book/ch03.adoc');
      expect(r.edges).toMatchObject([{ type: 'links_to', target: 'book/ch04.adoc' }]);
    });

    // @lat: [[tests/asciidoc-notes#Parser#Xref fragment]]
    it('resolves a fragment to a subpath and ignores same-file ids', () => {
      const r = parse('See xref:ch04.adoc#metagraphs[] and <<local-id>> and <<ch04.adoc#x,there>>.', 'book/ch03.adoc');
      expect(r.edges.map((e) => [e.target, e.subpath])).toEqual([
        ['book/ch04.adoc', 'metagraphs'],
        ['book/ch04.adoc', 'x'],
      ]);
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Native cross references become links#Anchor is not a link]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Anchor is not a link]]
    it('never reads an anchor as a link', () => {
      expect(parse('A paragraph with [[metagraph-def]] inside.').edges).toEqual([]);
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Includes become ordered edges#Book assembly]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Ordered includes]]
    it('orders includes and carries their attributes', () => {
      const r = parse(fixture('book.adoc'), 'book.adoc');
      const inc = r.edges.filter((e) => e.type === 'includes');
      expect(inc.map((e) => [e.target, e.props])).toEqual([
        ['chapters/ch01.adoc', { order: 1 }],
        ['chapters/ch02.adoc', { order: 2, leveloffset: '+1' }],
      ]);
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Includes become ordered edges#Code include]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Source include]]
    it('keeps the tags of a source include', () => {
      const r = parse(fixture('chapters/ch01.adoc'), 'chapters/ch01.adoc');
      expect(r.edges.filter((e) => e.type === 'includes')).toMatchObject([{ target: 'src/graph.ts', props: { order: 1, tags: 'upsert' } }]);
    });

    // @tg: verifies:: [[openspec:asciidoc-notes#Includes become ordered edges#Unknown attribute in path]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Unresolved include]]
    it('reports an include with an unset attribute', () => {
      const r = parse('= T\n\ninclude::{chapters}/ch01.adoc[]\n');
      expect(r.edges).toEqual([]);
      expect(r.warnings.map((w) => w.code)).toContain('adoc-include');
    });
  });

  describe('visible text', () => {
    // @tg: verifies:: [[openspec:chunking-verbalization#AsciiDoc chunks hold visible text#Metadata stripped]] {level: unit}
    // @lat: [[tests/asciidoc-notes#Parser#Visible text]]
    it('drops comments, attributes and includes but keeps xref text', () => {
      const r = parse('= T\n\n== S\n\n// ' + TG + ': defines:: [[Metagraph]]\n:tg-status: draft\n[source]\nSee xref:ch04.adoc[the next chapter].\n\ninclude::x.adoc[]\n');
      const chunk = r.chunks.find((c) => c.headingPath[0] === 'S')!;
      expect(chunk.text).toBe('See the next chapter.');
    });
  });
});
