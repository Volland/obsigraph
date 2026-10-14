import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { run } from '../src/cli.mjs';
import '../src/commands/index.mjs';

// Built from parts so the repository's own scanner does not read these fixtures as annotations.
const TG = '@' + 'tg';
const LAT = '@' + 'lat';

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-notes-'));
  const all = { 'lat.md/lat.md': '# Project\n\nDocs for the book.\n', ...files };
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}

async function tg(cwd: string, ...args: string[]) {
  let out = '';
  let err = '';
  const code = await run(args, { cwd, out: (t) => (out += t), err: (t) => (err += t), env: {} });
  return { code, out, err };
}

const CONFIG = JSON.stringify({ notes: ['book/**/*.adoc'] });
const CH03 = `////\ntype: Chapter\n////\n= Metagraphs\n\n// ${TG}: defines:: [[Metagraph]]\n== Definition\n\nA metagraph generalizes a hypergraph.\n\nSee xref:ch04.adoc[the next chapter].\n`;
const BOOK = {
  '.tg/config.json': CONFIG,
  'book/ch03.adoc': CH03,
  'book/ch04.adoc': '= Reification\n\n== Edges\n\nEdges become nodes.\n',
  'src/graph.ts': 'export function upsert() {}\n',
};

// @tg: verifies:: [[openspec:asciidoc-notes#Hosts index AsciiDoc notes#CLI notes glob]] {level: integration}
// @lat: [[tests/asciidoc-notes#Hosts#CLI checks notes globs]]
it('checks the notes matched by the config globs and passes a clean book', async () => {
  const dir = project({ ...BOOK, 'book/ch05.adoc': '= Five\n\ninclude::ch04.adoc[]\n\ninclude::../src/graph.ts[tags=upsert]\n' });
  const r = await tg(dir, 'check');
  expect(r.out).toContain('All checks passed');
  expect(r.out).toContain('3 .adoc');
  expect(r.code).toBe(0);
});

// @lat: [[tests/asciidoc-notes#Hosts#CLI broken links]]
it('reports a broken include, cross reference and source link as errors', async () => {
  const dir = project({
    ...BOOK,
    'book/ch06.adoc': `= Six\n\ninclude::missing.adoc[]\n\nSee xref:nowhere.adoc[x].\n\n// ${TG}: cites:: [[src/graph.ts#nothing]]\n// ${TG}: cites:: [[src/gone.ts#x]]\n`,
  });
  const r = await tg(dir, 'check');
  expect(r.code).toBe(1);
  expect(r.out).toContain('book/ch06.adoc:3: include target "book/missing.adoc" not found');
  expect(r.out).toContain('book/ch06.adoc:5: cross reference target "book/nowhere.adoc" not found');
  expect(r.out).toContain('symbol "nothing" not found in "src/graph.ts"');
  expect(r.out).toContain('file "src/gone.ts" not found');
});

// @lat: [[tests/asciidoc-notes#Hosts#CLI property and ambiguity errors]]
it('reports an include with an unset attribute, an ambiguous link and bad properties', async () => {
  const dir = project({
    '.tg/config.json': JSON.stringify({ notes: ['**/*.adoc'] }),
    'a.adoc': `////\nCopyright someone\n////\n= A\n\ninclude::{chapters}/x.adoc[]\n\n// ${TG}: see:: [[b]]\n`,
    'b.adoc': '= B\n',
  });
  const r = await tg(dir, 'check');
  expect(r.code).toBe(1);
  expect(r.out).toContain('Unresolved include: attribute {chapters}');
  expect(r.out).toContain('leading //// block is read as properties but is not valid YAML');
});

// @tg: verifies:: [[openspec:asciidoc-notes#Hosts index AsciiDoc notes#CLI notes glob]] {level: integration}
// @lat: [[tests/asciidoc-notes#Hosts#CLI never scans adoc as code]]
it('never reads annotations from AsciiDoc files, with or without a glob', async () => {
  const text = `= T\n\n// ${LAT}: [[nonexistent]]\n// ${TG}: implements:: [[openspec:nothing#Here]]\n`;
  for (const files of [{ 'notes/a.adoc': text } as Record<string, string>, { 'notes/a.adoc': text, '.tg/config.json': JSON.stringify({ notes: ['notes/*.adoc'] }) }]) {
    const r = await tg(project(files), 'check');
    expect(r.out).not.toContain('no matching section');
  }
});

// @lat: [[tests/asciidoc-notes#Hosts#CLI note warnings]]
it('warns about edge syntax that renders and about conflicting properties', async () => {
  const dir = project({
    '.tg/config.json': CONFIG,
    'book/ch.adoc': '////\nstatus: draft\n////\n= T\n:tg-status: final\n\ndefines:: [[Metagraph]]\n',
  });
  const r = await tg(dir, 'check');
  expect(r.code).toBe(0);
  expect(r.out).toContain('warning book/ch.adoc:7: Edge syntax outside a comment renders as a description list');
  expect(r.out).toContain("Property 'status' is set by the leading block");
  const json = JSON.parse((await tg(dir, '--json', 'check')).out) as { warnings: { code: string }[] };
  expect(json.warnings.map((w) => w.code).sort()).toEqual(['adoc-meta-conflict', 'adoc-visible-edge']);
});

// @tg: verifies:: [[openspec:asciidoc-notes#lat.md folder stays Markdown-only#AsciiDoc in lat.md]] {level: integration}
// @lat: [[tests/asciidoc-notes#Hosts#AsciiDoc in lat.md]]
it('warns that lat.md holds only Markdown and builds no sections from an .adoc file there', async () => {
  const dir = project({ 'lat.md/notes.adoc': '= Notes\n\n== Section\n\nText.\n' });
  const r = await tg(dir, 'check');
  expect(r.out).toContain('warning lat.md/notes.adoc: lat.md/ holds only Markdown; lat.md/notes.adoc is not read as lat.md sections');
  // The same finding lat check makes: only markdown belongs in lat.md/.
  expect(r.out).toContain('"notes.adoc" is not a .md file');
  expect((await tg(dir, 'locate', 'Section')).code).toBe(1);
});

// @lat: [[tests/asciidoc-notes#Hosts#CLI locate and search]]
it('finds sections of AsciiDoc notes with locate, section and search', async () => {
  const dir = project(BOOK);
  const locate = await tg(dir, 'locate', 'book/ch03.adoc#Definition');
  expect(locate.out).toContain('[[book/ch03.adoc#Definition]]');
  expect(locate.out).toContain('A metagraph generalizes a hypergraph.');
  const section = await tg(dir, 'section', 'book/ch03.adoc#Definition');
  expect(section.code).toBe(0);
  expect(section.out).toContain('(book/ch03.adoc:7-12)');
  const search = await tg(dir, 'search', '--lexical', 'metagraph hypergraph');
  expect(search.out).toContain('[[book/ch03.adoc#Definition]]');
  // Outside the globs, nothing is indexed.
  const none = project({ 'book/ch03.adoc': CH03 });
  expect((await tg(none, 'locate', 'book/ch03.adoc#Definition')).code).toBe(1);
});

// @lat: [[tests/asciidoc-notes#Hosts#CLI config error]]
it('reports a broken config file instead of ignoring it', async () => {
  const r = await tg(project({ '.tg/config.json': '{"notes": "book"}' }), 'check');
  expect(r.code).toBe(1);
  expect(r.out).toContain('.tg/config.json: "notes" must be a list of glob strings');
});

// @lat: [[tests/asciidoc-notes#Hosts#CLI init proposes globs]]
it('init proposes notes globs and a .tg/.gitignore that keeps the config, only when .adoc files exist', async () => {
  const dir = project({ 'book/ch03.adoc': CH03, 'book/deep/ch04.adoc': '= D\n', 'preface.adoc': '= P\n' });
  const r = await tg(dir, 'init', '--yes', '--only', 'instructions');
  expect(r.code).toBe(0);
  expect(JSON.parse(readFileSync(join(dir, '.tg/config.json'), 'utf8'))).toEqual({ notes: ['*.adoc', 'book/**/*.adoc'] });
  expect(readFileSync(join(dir, '.tg/.gitignore'), 'utf8')).toBe('vectors.json\nvectors.f32\n');
  expect(r.out).toContain('.tg/config.json proposes');
  // A second run leaves the edited config alone.
  writeFileSync(join(dir, '.tg/config.json'), CONFIG);
  await tg(dir, 'init', '--yes', '--only', 'instructions');
  expect(readFileSync(join(dir, '.tg/config.json'), 'utf8')).toBe(CONFIG);

  const plain = project({ 'src/a.ts': 'export {};\n' });
  await tg(plain, 'init', '--yes', '--only', 'instructions');
  expect(existsSync(join(plain, '.tg'))).toBe(false);
});

// @lat: [[tests/asciidoc-notes#Hosts#CLI init fixes old ignore]]
it('replaces an old catch-all .tg/.gitignore so the committed config is not ignored', async () => {
  const dir = project({ 'book/a.adoc': '= A\n', '.tg/.gitignore': '*\n', '.tg/config.json': CONFIG });
  await tg(dir, 'init', '--yes', '--only', 'instructions');
  expect(readFileSync(join(dir, '.tg/.gitignore'), 'utf8')).toBe('vectors.json\nvectors.f32\n');
});

// @tg: verifies:: [[openspec:asciidoc-notes#Includes become ordered edges#Code include]] {level: integration}
// @lat: [[tests/asciidoc-notes#Hosts#CLI graph with notes]]
it('puts AsciiDoc notes in the graph, with includes ending at the code node', async () => {
  const dir = project({
    ...BOOK,
    'book/ch05.adoc': '= Five\n\ninclude::ch04.adoc[]\n\ninclude::../src/graph.ts[tags=upsert]\n',
  });
  const nodes = JSON.parse((await tg(dir, '--json', 'cypher', 'MATCH (c:Chapter)-[r:defines]->(m) RETURN c.title, m.title, r.section')).out) as { rows: unknown[][] };
  expect(nodes.rows).toEqual([['Metagraphs', 'Metagraph', 'book/ch03.adoc#Definition']]);
  const inc = JSON.parse((await tg(dir, '--json', 'cypher', 'MATCH (b {title: "Five"})-[r:includes]->(t) RETURN t.title, labels(t), r.order, r.tags')).out) as { rows: unknown[][] };
  expect(inc.rows).toEqual([
    ['Reification', [], 1, null],
    ['graph.ts', ['CodeFile'], 2, 'upsert'],
  ]);
});
