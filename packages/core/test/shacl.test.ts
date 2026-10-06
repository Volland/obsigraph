import { Parser } from 'n3';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { readSchemaNote, schemaSetFromNotes, splitFrontmatter, type SchemaSet } from '../src/index.js';
import { exportShacl, importShacl, planImport, type ExistingNote } from '../src/shacl.js';

const ORG = {
  prefixes: { ex: 'https://example.org/' },
  schemas: {
    Person: {
      uri: 'schema:Person',
      properties: { email: { kind: 'text', required: true, uri: 'schema:email' }, status: { values: ['active', 'alumni'], default: 'active' }, aliases: 'list', score: { kind: 'number', default: 1.5 } },
      edges: { worksAt: 'Company', knows: { target: ['Person', 'Company'], many: false }, mentor: { target: 'Person', required: true } },
      visualization: { color: '#3b82f6', edges: { knows: { color: 'red' } } },
    },
    Company: { uri: 'schema:Organization', properties: { founded: 'date', site: { kind: 'link', uri: 'ex:site' }, seen: 'datetime', active: 'boolean' }, edges: [] },
  },
  edgeTypes: { worksAt: { from: 'Person', to: 'Company', uri: 'schema:worksFor', properties: { since: 'date', role: { required: true, values: ['dev', 'ops'] } }, visualization: { color: 'green' } } },
};

const setOf = (notes: Record<string, Record<string, unknown>>): SchemaSet => schemaSetFromNotes(Object.entries(notes).map(([p, fm]) => readSchemaNote(p, fm)));

/** Write a plan into a fresh in-memory vault and read the schema set back. */
function apply(texts: Map<string, string>, plan: ReturnType<typeof planImport>) {
  for (const w of plan.writes) texts.set(w.path, w.text);
  return texts;
}
const notesOf = (texts: Map<string, string>): ExistingNote[] =>
  [...texts].map(([path, text]) => ({ path, text, frontmatter: parseYaml(splitFrontmatter(text).yaml ?? '') ?? null }));
const setFromTexts = (texts: Map<string, string>) => schemaSetFromNotes(notesOf(texts).map((n) => readSchemaNote(n.path, n.frontmatter)));

describe('SHACL export', () => {
  const set = setOf({ 'Types/Org.md': ORG, 'Types/Team.md': { schema: { template: '[[Templates/Team]]' } } });
  const ttl = exportShacl(set, { body: (p) => (p === 'Types/Team.md' ? '## Members\n' : null) });

  // @lat: [[tests/shacl-interop#Export writes valid Turtle]]
  it('writes one node shape per type that parses as Turtle, deterministically', () => {
    const quads = new Parser().parse(ttl);
    const shapes = quads.filter((q) => q.predicate.value.endsWith('#type') && q.object.value.endsWith('shacl#NodeShape')).map((q) => q.subject.value);
    expect(shapes).toEqual(['urn:tgs:CompanyShape', 'urn:tgs:PersonShape', 'urn:tgs:TeamShape', 'urn:tgs:worksAtEdgeShape']);
    expect(exportShacl(set, { body: (p) => (p === 'Types/Team.md' ? '## Members\n' : null) })).toBe(ttl);
    const empty = exportShacl(setOf({}));
    expect(empty).not.toContain('sh:NodeShape');
    expect(empty).toContain('@prefix sh: <http://www.w3.org/ns/shacl#> .');
  });

  // @lat: [[tests/shacl-interop#Node type mapping]]
  it('maps types, kinds, cardinality, defaults, enums and declared URIs', () => {
    expect(ttl).toContain(':PersonShape\n    a sh:NodeShape ;\n    sh:targetClass schema:Person ;');
    expect(ttl).toContain('sh:targetClass schema:Organization ;');
    expect(ttl).toContain('        sh:path schema:email ;\n        sh:name "email" ;\n        sh:datatype xsd:string ;\n        sh:minCount 1 ;\n        sh:maxCount 1 ;');
    expect(ttl).toContain('sh:defaultValue "active" ;\n        sh:in ( "active" "alumni" ) ;');
    expect(ttl).toContain('sh:datatype xsd:string ;\n        tgs:kind "list" ;\n        sh:order 2');
    expect(ttl).toContain('sh:datatype xsd:decimal ;\n        sh:maxCount 1 ;\n        sh:defaultValue 1.5 ;');
    for (const t of ['xsd:date', 'xsd:dateTime', 'xsd:boolean']) expect(ttl).toContain(`sh:datatype ${t} ;`);
    expect(ttl).toContain('sh:path ex:site ;\n        sh:name "site" ;\n        sh:nodeKind sh:IRI ;');
  });

  // @lat: [[tests/shacl-interop#Edge mapping]]
  it('maps per-type edges to property shapes with classes and marks closed edge lists', () => {
    expect(ttl).toContain('sh:path schema:worksFor ;\n        sh:name "worksAt" ;\n        sh:class schema:Organization ;\n        sh:order 4');
    expect(ttl).toContain('sh:or ( [ sh:class schema:Person ] [ sh:class schema:Organization ] ) ;\n        sh:maxCount 1 ;');
    expect(ttl).toContain('sh:class schema:Person ;\n        sh:minCount 1 ;\n        sh:order 6');
    expect(ttl.match(/tgs:edgesClosed true/g)).toHaveLength(2);
  });

  // @lat: [[tests/shacl-interop#Edge type shapes]]
  it('exports edge types as reification shapes with endpoint and property constraints', () => {
    expect(ttl).toContain(
      ':worksAtEdgeShape\n    a sh:NodeShape ;\n    sh:name "worksAt" ;\n    tgs:note "Types/Org.md" ;\n    tgs:visualization "{\\"color\\":\\"green\\"}" ;\n' +
        '    sh:property [\n        sh:path rdf:predicate ;\n        sh:hasValue schema:worksFor\n    ] ;\n' +
        '    sh:property [\n        sh:path rdf:subject ;\n        sh:class schema:Person\n    ] ;\n' +
        '    sh:property [\n        sh:path rdf:object ;\n        sh:class schema:Organization\n    ] ;\n' +
        '    sh:property [\n        sh:path :since ;\n        sh:name "since" ;\n        sh:datatype xsd:date ;',
    );
  });

  // @lat: [[tests/shacl-interop#Annotations preserved]]
  it('keeps note, template and visualization as tgs annotations', () => {
    expect(ttl).toContain('tgs:visualization "{\\"color\\":\\"#3b82f6\\",\\"edges\\":{\\"knows\\":{\\"color\\":\\"red\\"}}}" ;');
    expect(ttl).toContain('tgs:note "Types/Team.md" ;\n    tgs:template "[[Templates/Team]]" ;\n    tgs:templateBody "## Members" .');
  });
});

describe('SHACL import', () => {
  const ttl = exportShacl(setOf({ 'Types/Person.md': { schema: { properties: { name: 'text' } } }, 'Types/Company.md': { schema: {} } }));

  // @lat: [[tests/shacl-interop#Import layouts]]
  it('creates one note per type by default, or a single note', () => {
    const per = planImport(importShacl(ttl), [], { layout: 'per-type' });
    expect(per.writes.map((w) => [w.path, w.text])).toEqual([
      ['Types/Company.md', '---\nschema: {}\n---\n'],
      ['Types/Person.md', '---\nschema:\n  properties: {name: text}\n---\n'],
    ]);
    const single = planImport(importShacl(ttl), [], { layout: 'single', into: 'Org' });
    expect(single.writes.map((w) => [w.path, w.text])).toEqual([['Types/Org.md', '---\nschemas:\n  Company: {}\n  Person:\n    properties: {name: text}\n---\n']]);
  });

  // @lat: [[tests/shacl-interop#Existing body kept]]
  it('replaces only the schema keys of an existing note', () => {
    const existing: ExistingNote = { path: 'Types/Person.md', text: '---\ntags: [ontology]\nschema:\n  properties:\n    old: number\ncssclasses: wide\n---\n\n# Person\n\nHand-written notes.\n', frontmatter: null };
    existing.frontmatter = parseYaml(splitFrontmatter(existing.text).yaml!);
    const plan = planImport(importShacl(ttl), [existing], {});
    const person = plan.writes.find((w) => w.path === 'Types/Person.md')!;
    expect(person.created).toBe(false);
    expect(person.text).toBe('---\ntags: [ontology]\nschema:\n  properties: {name: text}\ncssclasses: wide\n---\n\n# Person\n\nHand-written notes.\n');
  });

  // @lat: [[tests/shacl-interop#Mixed note protected]]
  it('refuses to rewrite a note that declares types missing from the import unless forced', () => {
    const text = '---\nschemas:\n  Person: {}\n  Team: {}\n---\nDocs\n';
    const existing: ExistingNote = { path: 'Types/Org.md', text, frontmatter: parseYaml(splitFrontmatter(text).yaml!) };
    const plan = planImport(importShacl(ttl), [existing], {});
    expect(plan.writes.map((w) => w.path)).toEqual(['Types/Company.md']);
    expect(plan.conflicts).toEqual([{ path: 'Types/Org.md', message: 'Types/Org.md also declares Team, which the import does not contain; left unchanged (use --force to update it anyway)' }]);
    const forced = planImport(importShacl(ttl), [existing], { force: true });
    expect(forced.writes.find((w) => w.path === 'Types/Org.md')!.text).toBe('---\nschemas:\n  Person:\n    properties: {name: text}\n  Team: {}\n---\nDocs\n');
  });

  // @lat: [[tests/shacl-interop#External shapes imported]]
  it('reads foreign SHACL with schema.org IRIs, sh:node edges and reification shapes', () => {
    const foreign = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix schema: <https://schema.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix ex: <https://example.org/shapes/> .
      ex:PersonShape a sh:NodeShape ; sh:targetClass schema:Person ;
        sh:property [ sh:path schema:email ; sh:datatype xsd:string ; sh:minCount 1 ] ;
        sh:property [ sh:path schema:birthDate ; sh:datatype xsd:date ; sh:maxCount 1 ] ;
        sh:property [ sh:path schema:worksFor ; sh:node ex:OrgShape ] .
      ex:OrgShape a sh:NodeShape ; sh:targetClass schema:Organization .
      ex:Employment a sh:NodeShape ;
        sh:property [ sh:path rdf:predicate ; sh:hasValue schema:worksFor ] ;
        sh:property [ sh:path rdf:subject ; sh:class schema:Person ] ;
        sh:property [ sh:path schema:startDate ; sh:datatype xsd:date ] .
    `;
    const imp = importShacl(foreign);
    expect(imp.dropped).toEqual([]);
    expect(imp.prefixes).toEqual({ ex: 'https://example.org/shapes/' });
    const person = imp.types.find((t) => t.type === 'Person')!;
    expect(person.uri).toBe('schema:Person');
    expect(person.properties.map((p) => [p.name, p.kind, p.required, p.many, p.uri])).toEqual([
      ['birthDate', 'date', false, false, 'schema:birthDate'],
      ['email', 'text', true, true, 'schema:email'],
    ]);
    expect(person.edges).toEqual([{ type: 'worksFor', targets: ['Organization'], many: true, required: false }]);
    expect(imp.edgeTypes).toMatchObject([{ type: 'worksFor', from: ['Person'], to: null, uri: 'schema:worksFor', properties: [{ name: 'startDate', kind: 'date' }] }]);
  });

  // @lat: [[tests/shacl-interop#Unsupported constructs reported]]
  it('reports constructs outside the subset and imports the rest of the shape', () => {
    const foreign = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix ex: <https://example.org/> .
      ex:ThingShape a sh:NodeShape ; sh:targetClass ex:Thing ; sh:closed true ;
        sh:property [ sh:path ex:code ; sh:datatype xsd:string ; sh:pattern "^[A-Z]+$" ] ;
        sh:property [ sh:path ex:kind ; sh:or ( [ sh:datatype xsd:string ] [ sh:datatype xsd:integer ] ) ] ;
        sh:property [ sh:path ( ex:a ex:b ) ; sh:datatype xsd:string ] ;
        sh:property [ sh:path ex:weight ; sh:datatype xsd:gYear ] .
      ex:Loose a sh:NodeShape ; sh:property [ sh:path ex:x ] .
    `;
    const imp = importShacl(foreign);
    expect(imp.dropped).toEqual([
      { shape: 'Thing', construct: 'sh:closed' },
      { shape: 'Thing.code', construct: 'sh:pattern' },
      { shape: 'Thing.kind', construct: 'sh:or (alternative other than a single sh:class)' },
      { shape: 'Thing.kind', construct: 'sh:or (alternative other than a single sh:class)' },
      { shape: 'Thing.weight', construct: 'sh:datatype xsd:gYear (read as text)' },
      { shape: 'Thing', construct: 'sh:path (property path other than a single IRI)' },
      { shape: 'ex:Loose', construct: 'node shape without sh:targetClass' },
    ]);
    expect(imp.types.map((t) => [t.type, t.properties.map((p) => p.name)])).toEqual([['Thing', ['code', 'kind', 'weight']]]);
  });

  // @lat: [[tests/shacl-interop#Round trip is lossless]]
  it('reproduces the same Turtle after export, import into an empty vault and export', () => {
    const body = (texts: Map<string, string>) => (p: string) => (texts.has(p) ? splitFrontmatter(texts.get(p)!).body : null);
    const original = new Map([
      ['Types/Org.md', `---\n${JSON.stringify(ORG)}\n---\n\nDocs for the org model.\n`],
      ['Types/Team.md', '---\nschema:\n  template: "[[Templates/Team]]"\n  properties: {size: number}\n---\n\n## Members\n'],
      ['Types/Doc.md', '---\nschema:\n  properties: {title: text}\n---\n\n## Summary\n'],
    ]);
    const first = exportShacl(setFromTexts(original), { body: body(original) });
    const imported = apply(new Map(), planImport(importShacl(first), [], {}));
    expect([...imported.keys()].sort()).toEqual(['Types/Doc.md', 'Types/Org.md', 'Types/Team.md']);
    expect(imported.get('Types/Doc.md')).toBe('---\nschema:\n  properties: {title: text}\n---\n\n## Summary\n');
    const second = exportShacl(setFromTexts(imported), { body: body(imported) });
    expect(second).toBe(first);
    const again = planImport(importShacl(second), notesOf(imported), {});
    expect(again.writes).toEqual([]);
    expect(again.unchanged.sort()).toEqual(['Types/Doc.md', 'Types/Org.md', 'Types/Team.md']);
  });
});
