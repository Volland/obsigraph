import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  Graph,
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
      { name: 'status', kind: 'text', default: 'active', required: false },
      { name: 'born', kind: 'date', default: null, required: true },
      { name: 'age', kind: 'number', default: null, required: false },
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
    expect(merged.edges).toEqual(['knows', 'worksAt']);
    expect(mergeSchemas(['Unknown'], new Map())).toBeNull();
  });

  // @lat: [[tests/schema-notes#Template applied]]
  it('renders a new note with type, defaults and the template body', () => {
    const { schema } = readSchema('Types/Person.md', { schema: { properties: { status: { default: 'active' }, tags: { default: ['a', 'b'] }, born: 'date' } } });
    const text = renderNoteFromType(schema, '## Notes\n');
    expect(text).toBe('---\ntype: Person\nstatus: active\ntags:\n  - a\n  - b\n---\n\n## Notes\n');
    expect(splitFrontmatter(text)).toEqual({ yaml: 'type: Person\nstatus: active\ntags:\n  - a\n  - b', body: '## Notes\n' });
    expect(parseYaml(splitFrontmatter(renderNoteFromType({ ...schema, properties: [{ name: 'code', kind: 'text', default: '007', required: false }, { name: 'flag', kind: 'text', default: 'yes', required: false }] }, '')).yaml!)).toEqual({ type: 'Person', code: '007', flag: 'yes' });
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
    expect(r.schema.properties).toEqual([{ name: 'status', kind: 'text', default: 'active', required: false }]);
    expect(r.schema.edges).toBeNull();
  });
});
