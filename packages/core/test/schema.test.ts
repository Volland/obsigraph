import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  chooseTemplate,
  edgeNames,
  expandIri,
  Graph,
  readSchemaNote,
  styleSourcesFromSchemas,
  resolveEdgeStyle,
  templatePath,
  type PropertySchema,
  isSchemaPath,
  mergeSchemas,
  readSchema,
  renderNoteFromType,
  scaffoldSchemaNote,
  schemasFromGraph,
  splitFrontmatter,
  validateSchemas,
  type NoteInput,
} from '../src/index.js';

function vault(notes: NoteInput[]) {
  const paths = new Set(notes.map((n) => n.path));
  const graph = new Graph((l) => {
    for (const p of paths) if (p === `${l}.md` || p.endsWith(`/${l}.md`)) return p;
    return null;
  });
  for (const n of notes) graph.upsertNote(n);
  return graph;
}

const prop = (name: string, def: unknown = null): PropertySchema => ({ name, kind: 'text', default: def, required: false, many: false, values: null, uri: null });

const person = (schema: Record<string, unknown>): NoteInput => ({ path: 'Types/Person.md', text: '', frontmatter: { schema } });

describe('schema notes', () => {
  // @lat: [[tests/schema-notes#Schema found by location]]
  it('finds the schema for a type by note title in the schema folder', () => {
    const graph = vault([person({ properties: { status: 'text' } }), { path: 'Alice.md', text: '', frontmatter: { type: 'Person' } }]);
    const set = schemasFromGraph(graph, 'Types');
    expect([...set.schemas.keys()]).toEqual(['Person']);
    expect(mergeSchemas(['Person'], set.schemas)!.properties.map((p) => p.name)).toEqual(['status']);
    expect(isSchemaPath('Types/Person.md', 'Types/')).toBe(true);
    expect(isSchemaPath('Types/sub/Person.md', 'Types/')).toBe(false);
    expect(isSchemaPath('Other/Person.md', 'Types/')).toBe(false);
  });

  // @lat: [[tests/schema-notes#No schemas no effect]]
  it('raises nothing when no schema notes exist', () => {
    const graph = vault([{ path: 'Alice.md', text: 'owns:: [[Car]]', frontmatter: { type: 'Person' } }]);
    const set = schemasFromGraph(graph, 'Types/');
    expect(set.schemas.size).toBe(0);
    expect(set.diagnostics).toEqual([]);
    expect(validateSchemas(graph, set)).toEqual([]);
  });

  // @lat: [[tests/schema-notes#Property declarations read]]
  it('reads properties in map, shorthand and list form with kinds, defaults and required', () => {
    const map = readSchema('Types/Person.md', { schema: { properties: { status: { kind: 'text', default: 'active' }, born: { kind: 'date', required: true }, age: 'number' } } });
    expect(map.diagnostics).toEqual([]);
    expect(map.schema.properties).toEqual([
      { name: 'status', kind: 'text', default: 'active', required: false, many: false, values: null, uri: null },
      { name: 'born', kind: 'date', default: null, required: true, many: false, values: null, uri: null },
      { name: 'age', kind: 'number', default: null, required: false, many: false, values: null, uri: null },
    ]);
    const list = readSchema('Types/Car.md', { schema: { properties: [{ name: 'plate', required: true }, 'color'] } });
    expect(list.schema.type).toBe('Car');
    expect(list.schema.properties.map((p) => [p.name, p.kind, p.required])).toEqual([['plate', 'text', true], ['color', 'text', false]]);
  });

  // @lat: [[tests/schema-notes#Unknown kind becomes text]]
  it('treats an unknown kind as text and reports it', () => {
    const r = readSchema('Types/Person.md', { schema: { properties: { mood: { kind: 'emotion' } } } });
    expect(r.schema.properties[0]!.kind).toBe('text');
    expect(r.diagnostics).toEqual([{ path: 'Types/Person.md', line: 0, column: 0, message: "Property 'mood' has unknown kind 'emotion'; treated as text" }]);
  });

  // @lat: [[tests/schema-notes#Disallowed edge reported]]
  it('reports an edge type not allowed for the source type, and allows anything without a list', () => {
    const graph = vault([
      person({ edges: ['knows', 'worksAt'] }),
      { path: 'Types/Company.md', text: '', frontmatter: { schema: { properties: {} } } },
      { path: 'Alice.md', text: 'knows:: [[Bob]]\nowns:: [[Car]]', frontmatter: { type: 'Person' } },
      { path: 'Acme.md', text: 'owns:: [[Car]]', frontmatter: { type: 'Company' } },
    ]);
    const diags = validateSchemas(graph, schemasFromGraph(graph, 'Types/'));
    expect(diags).toEqual([
      { path: 'Alice.md', line: 1, column: 0, message: "Edge type 'owns' is not allowed for Person (allowed: knows, worksAt)" },
    ]);
  });

  // @lat: [[tests/schema-notes#Missing required property reported]]
  it('reports a missing required property but keeps the node', () => {
    const graph = vault([person({ properties: { born: { kind: 'date', required: true } } }), { path: 'Alice.md', text: '', frontmatter: { type: 'Person' } }]);
    const diags = validateSchemas(graph, schemasFromGraph(graph, 'Types/'));
    expect(diags).toEqual([{ path: 'Alice.md', line: 0, column: 0, message: "Missing required property 'born' for type Person" }]);
    expect(graph.node('Alice.md')).toBeDefined();
  });

  // @lat: [[tests/schema-notes#Multi-label merge]]
  it('merges multi-label schemas: first property wins, edge lists union', () => {
    const graph = vault([
      person({ properties: { status: { default: 'active' } }, edges: ['knows'] }),
      { path: 'Types/Employee.md', text: '', frontmatter: { schema: { properties: { status: { default: 'hired' }, badge: 'number' }, edges: ['worksAt'] } } },
    ]);
    const merged = mergeSchemas(['Person', 'Employee', 'Unknown'], schemasFromGraph(graph, 'Types/').schemas)!;
    expect(merged.properties.map((p) => [p.name, p.default])).toEqual([['status', 'active'], ['badge', null]]);
    expect(edgeNames(merged)).toEqual(['knows', 'worksAt']);
    expect(mergeSchemas(['Unknown'], new Map())).toBeNull();
  });

  // @lat: [[tests/schema-notes#Template applied]]
  it('renders a new note with type, defaults and the template body', () => {
    const { schema } = readSchema('Types/Person.md', { schema: { properties: { status: { default: 'active' }, tags: { default: ['a', 'b'] }, born: 'date' } } });
    const text = renderNoteFromType(schema, '## Notes\n');
    expect(text).toBe('---\ntype: Person\nstatus: active\ntags:\n  - a\n  - b\n---\n\n## Notes\n');
    expect(splitFrontmatter(text)).toEqual({ yaml: 'type: Person\nstatus: active\ntags:\n  - a\n  - b', body: '## Notes\n' });
    expect(parseYaml(splitFrontmatter(renderNoteFromType({ ...schema, properties: [prop('code', '007'), prop('flag', 'yes')] }, '')).yaml!)).toEqual({ type: 'Person', code: '007', flag: 'yes' });
  });

  // @lat: [[tests/schema-notes#Schema changes apply live]]
  it('picks up a schema edit on the next validation', () => {
    const alice: NoteInput = { path: 'Alice.md', text: '', frontmatter: { type: 'Person' } };
    const graph = vault([person({ properties: { born: 'date' } }), alice]);
    expect(validateSchemas(graph, schemasFromGraph(graph, 'Types/'))).toEqual([]);
    graph.upsertNote(person({ properties: { born: { kind: 'date', required: true } } }));
    expect(validateSchemas(graph, schemasFromGraph(graph, 'Types/'))).toHaveLength(1);
  });

  // @lat: [[tests/schema-notes#Scaffold is a valid schema]]
  it('scaffolds a schema note that reads back without diagnostics and restricts no edges', () => {
    const { yaml } = splitFrontmatter(scaffoldSchemaNote());
    const r = readSchema('Types/New.md', parseYaml(yaml!));
    expect(r.diagnostics).toEqual([]);
    expect(r.schema.properties).toEqual([prop('status', 'active')]);
    expect(r.schema.edges).toBeNull();
  });
});

const note = (path: string, frontmatter: Record<string, unknown>, text = ''): NoteInput => ({ path, text, frontmatter });

describe('typed graph schema (TGS) declarations', () => {
  // @lat: [[tests/schema-notes#Multi-type notes]]
  it('reads several types from one note, alongside the title type, and ignores notes outside the folder', () => {
    const graph = vault([
      note('Types/People and Orgs.md', { schemas: { Person: { properties: { name: 'text' } }, Company: { properties: { founded: 'date' } } } }),
      note('Types/Address.md', { schema: { properties: { city: 'text' } }, schemas: { Street: {} } }),
      note('Types/archive/Old.md', { schemas: { Legacy: {} } }),
      note('Elsewhere.md', { schemas: { Stray: {} } }),
    ]);
    const set = schemasFromGraph(graph, 'Types/');
    expect([...set.schemas.keys()].sort()).toEqual(['Address', 'Company', 'Person', 'Street']);
    expect(set.schemas.get('Person')!.bodyIsTemplate).toBe(false);
    expect(set.schemas.get('Address')!.bodyIsTemplate).toBe(true);
    expect(set.diagnostics).toEqual([]);
  });

  // @lat: [[tests/schema-notes#Property attributes read]]
  it('reads many, values, uri and the datetime and list kinds', () => {
    const r = readSchemaNote('Types/Person.md', {
      schema: { properties: { status: { kind: 'text', values: ['active', 'alumni'], many: true }, seen: 'datetime', aliases: 'list', email: { uri: 'schema:email' } } },
    });
    expect(r.diagnostics).toEqual([]);
    const [status, seen, aliases, email] = r.types[0]!.properties;
    expect(status).toMatchObject({ values: ['active', 'alumni'], many: true });
    expect(seen).toMatchObject({ kind: 'datetime', many: false });
    expect(aliases).toMatchObject({ kind: 'list', many: true });
    expect(email).toMatchObject({ kind: 'text', uri: 'schema:email' });
  });

  // @lat: [[tests/schema-notes#Edge map form]]
  it('reads the map form of edges with targets, many and required', () => {
    const r = readSchemaNote('Types/Person.md', { schema: { edges: { worksAt: 'Company', knows: { target: 'Person', many: true }, mentor: { target: ['Person', 'Team'], many: false, required: true }, likes: null } } });
    expect(r.diagnostics).toEqual([]);
    expect(r.types[0]!.edges).toEqual([
      { type: 'worksAt', targets: ['Company'], many: true, required: false },
      { type: 'knows', targets: ['Person'], many: true, required: false },
      { type: 'mentor', targets: ['Person', 'Team'], many: false, required: true },
      { type: 'likes', targets: null, many: true, required: false },
    ]);
    expect(readSchemaNote('Types/X.md', { schema: { edges: 5 } }).diagnostics[0]!.message).toBe('`edges` must be a list or a mapping of edge types');
  });

  // @lat: [[tests/schema-notes#Edge types read]]
  it('reads edge types with endpoints, properties, uri and visualization', () => {
    const r = readSchemaNote('Types/Org.md', {
      edgeTypes: { worksAt: { from: 'Person', to: ['Company'], properties: { since: 'date', role: { kind: 'text', required: true } }, uri: 'schema:worksFor', visualization: { color: 'green' } } },
    });
    expect(r.types).toEqual([]);
    expect(r.edgeTypes).toEqual([
      { type: 'worksAt', path: 'Types/Org.md', from: ['Person'], to: ['Company'], properties: [{ ...prop('since'), kind: 'date' }, { ...prop('role'), required: true }], uri: 'schema:worksFor', style: { color: 'green' } },
    ]);
  });

  // @lat: [[tests/schema-notes#Duplicate types reported]]
  it('keeps the first declaration by path and names both notes', () => {
    const graph = vault([
      note('Types/B.md', { schemas: { Person: { properties: { b: 'text' } } } }),
      note('Types/A.md', { schemas: { Person: { properties: { a: 'text' } } } }),
    ]);
    const set = schemasFromGraph(graph, 'Types/');
    expect(set.schemas.get('Person')!.path).toBe('Types/A.md');
    expect(set.diagnostics).toEqual([{ path: 'Types/B.md', line: 0, column: 0, message: "Type 'Person' is declared in both Types/A.md and Types/B.md; using Types/A.md" }]);
  });

  // @lat: [[tests/schema-notes#Identifiers expanded]]
  it('expands CURIEs with built-in and declared prefixes and reports unknown ones', () => {
    expect(expandIri('schema:Organization', { schema: 'https://schema.org/' })).toEqual({ iri: 'https://schema.org/Organization' });
    expect(expandIri('https://x.org/a', {})).toEqual({ iri: 'https://x.org/a' });
    expect(expandIri('urn:isbn:1', {})).toEqual({ iri: 'urn:isbn:1' });
    const graph = vault([
      note('Types/Org.md', { prefixes: { ex: 'https://example.org/' }, schemas: { Company: { uri: 'schema:Organization' }, Thing: { uri: 'ex:Thing' }, Other: { uri: 'zz:Other' } } }),
    ]);
    const set = schemasFromGraph(graph, 'Types/');
    expect(set.prefixes.ex).toBe('https://example.org/');
    expect(set.diagnostics).toEqual([{ path: 'Types/Org.md', line: 0, column: 0, message: "Type 'Other' has uri 'zz:Other': unknown prefix 'zz'" }]);
  });

  // @lat: [[tests/schema-notes#TGS version handling]]
  it('reads newer minor versions reporting unknown keys and ignores other major versions', () => {
    const minor = readSchemaNote('Types/Person.md', { tgs: '0.2', schema: { properties: { a: 'text' }, inherits: 'Agent' } });
    expect(minor.types[0]!.properties.map((p) => p.name)).toEqual(['a']);
    expect(minor.diagnostics.map((d) => d.message)).toEqual(["Unknown key 'inherits' (newer TGS version?)"]);
    const major = readSchemaNote('Types/Person.md', { tgs: '1.0', schema: { properties: { a: 'text' } } });
    expect(major.types).toEqual([]);
    expect(major.diagnostics[0]!.message).toContain('TGS version 1.0 is not supported');
    expect(readSchemaNote('Types/Person.md', { tgs: 0.1, schema: { x: 1 } }).diagnostics).toEqual([]);
  });
});

describe('TGS validation', () => {
  const org = note('Types/Org.md', {
    schemas: {
      Person: { properties: { status: { values: ['active', 'alumni'] }, nick: 'text' }, edges: { worksAt: { target: 'Company', required: true, many: false }, knows: 'Person' } },
      Company: {},
    },
    edgeTypes: { worksAt: { from: 'Person', properties: { role: { kind: 'text', required: true, values: ['dev', 'ops'] } } } },
  });

  // @lat: [[tests/schema-notes#Value and cardinality validation]]
  it('reports enum violations, unexpected lists, missing required edges and repeated single edges', () => {
    const graph = vault([
      org,
      note('Acme.md', { type: 'Company' }),
      note('Beta.md', { type: 'Company' }),
      note('Alice.md', { type: 'Person', status: 'retired', nick: ['a', 'b'] }, 'worksAt:: [[Acme]] {role: dev}\nworksAt:: [[Beta]] {role: dev}'),
      note('Bob.md', { type: 'Person', status: 'active' }),
    ]);
    const msgs = validateSchemas(graph, schemasFromGraph(graph, 'Types/')).map((d) => `${d.path}:${d.line} ${d.message}`);
    expect(msgs).toEqual([
      "Alice.md:0 Property 'status' value 'retired' is not one of: active, alumni",
      "Alice.md:0 Property 'nick' holds a list but is not declared many for type Person",
      'Alice.md:1 Edge type \'worksAt\' allows one edge for Person, found 2',
      "Bob.md:0 Missing required edge 'worksAt' for type Person",
    ]);
  });

  // @lat: [[tests/schema-notes#Edge property validation]]
  it('reports missing required and enum-violating edge properties at the edge line, accepting extra ones', () => {
    const graph = vault([
      org,
      note('Acme.md', { type: 'Company' }),
      note('Alice.md', { type: 'Person' }, 'worksAt:: [[Acme]] {since: 2020, note: "x"}'),
      note('Carol.md', { type: 'Person' }, 'worksAt:: [[Acme]] {role: cto}'),
    ]);
    const diags = validateSchemas(graph, schemasFromGraph(graph, 'Types/'));
    expect(diags).toEqual([
      { path: 'Alice.md', line: 0, column: 0, message: "Missing required property 'role' on edge 'worksAt'" },
      { path: 'Carol.md', line: 0, column: 0, message: "Edge property 'role' value 'cto' is not one of: dev, ops" },
    ]);
    expect(graph.edges().next().value).toBeDefined();
  });

  // @lat: [[tests/schema-notes#Edge endpoint validation]]
  it('reports wrong target and source types but not stubs or untyped notes', () => {
    const graph = vault([
      org,
      note('Bob.md', { type: 'Person' }, 'worksAt:: [[Plain]] {role: dev}\nknows:: [[Ghost]]'),
      note('Plain.md', {}),
      note('Alice.md', { type: 'Person' }, 'worksAt:: [[Bob]] {role: dev}'),
      note('Acme.md', { type: 'Company' }, 'worksAt:: [[Bob]] {role: dev}'),
    ]);
    const msgs = validateSchemas(graph, schemasFromGraph(graph, 'Types/')).map((d) => `${d.path}:${d.line} ${d.message}`);
    expect(msgs).toEqual([
      "Alice.md:0 Edge 'worksAt' expects target type Company, found Person",
      "Acme.md:0 Edge 'worksAt' expects source type Person, found Company",
    ]);
  });
});

describe('templates', () => {
  // @lat: [[tests/schema-notes#Template note used]]
  it('resolves template links and prefers the linked note over the schema body', () => {
    const resolve = (l: string) => (l === 'Templates/Person' || l === 'Person' ? 'Templates/Person.md' : null);
    expect(templatePath('[[Templates/Person]]', 'Types/Person.md', resolve)).toBe('Templates/Person.md');
    expect(templatePath('[[Person|tpl]]', 'Types/Person.md', resolve)).toBe('Templates/Person.md');
    expect(templatePath('[Person](../Templates/Person.md)', 'Types/Person.md', resolve)).toBe('Templates/Person.md');
    expect(templatePath('Templates/Person', 'Types/Person.md', resolve)).toBe('Templates/Person.md');
    const { schema } = readSchema('Types/Person.md', { schema: { template: '[[Templates/Person]]' } });
    expect(schema.template).toBe('[[Templates/Person]]');
    expect(chooseTemplate(schema, { linkedBody: '## From template', schemaBody: '## From schema' })).toEqual({ body: '## From template', generated: false });
    expect(chooseTemplate(schema, { linkedBody: null, schemaBody: '## From schema' })).toEqual({ body: '## From schema', generated: false });
  });

  // @lat: [[tests/schema-notes#Template generated]]
  it('generates a template with property placeholders and edge lines that create no edges', () => {
    const set = schemaSetFromGraph([note('Types/Org.md', { schemas: { Company: { properties: { name: 'text', founded: 'date', tags: 'list', size: { default: 'small' } }, edges: { employs: 'Person' } } } }, '# Org docs')]);
    const company = set.schemas.get('Company')!;
    const { body, generated } = chooseTemplate(company, { linkedBody: null, schemaBody: '# Org docs' });
    expect(generated).toBe(true);
    const text = renderNoteFromType(company, body, { placeholders: true });
    expect(text).toBe('---\ntype: Company\nname:\nfounded:\ntags: []\nsize: small\n---\n\n## Notes\n\n## Relations\n\n- employs::\n');
    expect(parseYaml(splitFrontmatter(text).yaml!)).toEqual({ type: 'Company', name: null, founded: null, tags: [], size: 'small' });
    const graph = vault([{ path: 'Acme.md', text, frontmatter: parseYaml(splitFrontmatter(text).yaml!) }]);
    expect(graph.outEdges('Acme.md')).toEqual([]);
    expect(graph.diagnostics()).toEqual([]);
  });
});

describe('edge type styling', () => {
  // @lat: [[tests/visualization-config#Edge type entry styles edges]]
  it('styles edges from an edgeTypes entry, winning over visualization.edges per attribute', () => {
    const set = schemaSetFromGraph([
      note('Types/Org.md', { edgeTypes: { worksAt: { visualization: { color: 'green' } } } }),
      note('Types/Person.md', { schema: { visualization: { edges: { worksAt: { color: 'red', line: 'dashed' } } } } }),
    ]);
    const { sources, diagnostics } = styleSourcesFromSchemas(set.schemas, undefined, set.edgeTypes);
    expect(diagnostics).toEqual([]);
    const s = resolveEdgeStyle('worksAt', 1, sources);
    expect([s.color, s.line]).toEqual(['green', 'dashed']);
  });
});

function schemaSetFromGraph(notes: NoteInput[]) {
  return schemasFromGraph(vault(notes), 'Types/');
}
