import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  DEFAULT_BASE_IRI,
  Graph,
  iriOf,
  readSchemaNote,
  scaffoldSchemaNote,
  schemasFromGraph,
  splitFrontmatter,
  validateSchemas,
  type Diagnostic,
  type NoteInput,
  type SchemaSet,
} from '../src/index.js';
import { exportShacl } from '../src/shacl.js';

const SPEC = join(__dirname, '../../../spec/tgs');
const WRITE = process.env.TGS_WRITE_EXPECTED === '1';
const ajv = new Ajv({ strict: true, allowUnionTypes: true });
const validateJson = ajv.compile(JSON.parse(readFileSync(join(SPEC, 'tgs.schema.json'), 'utf8')));

/** Diagnostic names from the spec, mapped from the reference implementation's messages. */
const DIAGNOSTICS: [RegExp, string][] = [
  [/has unknown kind/, 'unknown-kind'],
  [/is declared in both/, 'duplicate-declaration'],
  [/unknown prefix/, 'unknown-prefix'],
  [/TGS version .* is not supported/, 'unsupported-version'],
  [/^Unknown key|: Unknown key/, 'unknown-key'],
  [/^Missing required property '.*' for type/, 'missing-property'],
  [/^Missing required property '.*' on edge/, 'missing-edge-property'],
  [/^Edge property '.*' value/, 'edge-value-not-allowed'],
  [/^Property '.*' value '.*' is not one of/, 'value-not-allowed'],
  [/holds a list but is not declared many/, 'unexpected-list'],
  [/is not allowed for/, 'edge-not-allowed'],
  [/^Missing required edge/, 'missing-edge'],
  [/allows one edge/, 'too-many-edges'],
  [/expects target type/, 'wrong-target-type'],
  [/expects source type/, 'wrong-source-type'],
];
const nameOf = (message: string) => DIAGNOSTICS.find(([re]) => re.test(message))?.[1] ?? 'invalid-declaration';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
}

function loadVault(dir: string): NoteInput[] {
  return files(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const text = readFileSync(f, 'utf8');
      const { yaml } = splitFrontmatter(text);
      return { path: relative(dir, f), text, frontmatter: yaml === null ? null : (parseYaml(yaml) as Record<string, unknown>) };
    });
}

function graphOf(notes: NoteInput[]): Graph {
  const paths = new Set(notes.map((n) => n.path));
  const graph = new Graph((l) => [...paths].find((p) => p === `${l}.md` || p.endsWith(`/${l}.md`)) ?? null);
  for (const n of notes) graph.upsertNote(n);
  return graph;
}

/** Declarations in an implementation-neutral form: names, expanded IRIs and defaults applied. */
function declarations(set: SchemaSet) {
  const iri = (d: { uri: string | null }, name: string) => iriOf(d, name, DEFAULT_BASE_IRI, set.prefixes);
  const props = (ps: SchemaSet['schemas'] extends Map<string, infer T> ? (T extends { properties: infer P } ? P : never) : never) =>
    ps.map((p) => ({ name: p.name, iri: iri(p, p.name), kind: p.kind, required: p.required, many: p.many, values: p.values, default: p.default }));
  return {
    types: [...set.schemas.values()]
      .sort((a, b) => a.type.localeCompare(b.type))
      .map((t) => ({ name: t.type, note: t.path, iri: iri(t, t.type), properties: props(t.properties), edges: t.edges, template: t.template })),
    edgeTypes: [...set.edgeTypes.values()]
      .sort((a, b) => a.type.localeCompare(b.type))
      .map((e) => ({ name: e.type, note: e.path, iri: iri(e, e.type), from: e.from, to: e.to, properties: props(e.properties) })),
  };
}

const diagnosticsOf = (ds: Diagnostic[]) =>
  ds
    .map((d) => ({ path: d.path, line: d.line ? d.line + 1 : null, diagnostic: nameOf(d.message) }))
    .sort((a, b) => `${a.path}:${String(a.line).padStart(5, '0')}:${a.diagnostic}`.localeCompare(`${b.path}:${String(b.line).padStart(5, '0')}:${b.diagnostic}`));

const cases = readdirSync(join(SPEC, 'examples')).sort();

describe('TGS conformance examples', () => {
  // @lat: [[tests/tgs-spec#Conformance examples pass]]
  it.each(cases)('%s', (name) => {
    const dir = join(SPEC, 'examples', name);
    const notes = loadVault(join(dir, 'vault'));
    const graph = graphOf(notes);
    const set = schemasFromGraph(graph, 'Types/');
    const actual = { ...declarations(set), diagnostics: diagnosticsOf([...set.diagnostics, ...validateSchemas(graph, set)]) };
    const expectedPath = join(dir, 'expected.json');
    const shapesPath = join(dir, 'shapes.ttl');
    const bodies = new Map(notes.map((n) => [n.path, splitFrontmatter(n.text).body]));
    const ttl = exportShacl(set, { body: (p) => bodies.get(p) ?? null });
    if (WRITE) {
      const old = existsSync(expectedPath) ? (JSON.parse(readFileSync(expectedPath, 'utf8')) as { invalidAgainstJsonSchema?: string[] }) : {};
      writeFileSync(expectedPath, `${JSON.stringify({ invalidAgainstJsonSchema: old.invalidAgainstJsonSchema ?? [], ...actual }, null, 2)}\n`);
      if (name.includes('shacl')) writeFileSync(shapesPath, ttl);
    }
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as typeof actual & { invalidAgainstJsonSchema: string[] };
    expect(actual).toEqual({ types: expected.types, edgeTypes: expected.edgeTypes, diagnostics: expected.diagnostics });
    if (existsSync(shapesPath)) expect(ttl).toBe(readFileSync(shapesPath, 'utf8'));
    for (const n of notes.filter((x) => x.path.startsWith('Types/'))) {
      expect(validateJson(n.frontmatter ?? {}), `${name}/${n.path} against the JSON Schema`).toBe(!expected.invalidAgainstJsonSchema.includes(n.path));
    }
  });
});

describe('TGS JSON Schema', () => {
  // @lat: [[tests/tgs-spec#Spec examples validate]]
  it('accepts every YAML example in the specification and the scaffold', () => {
    const spec = readFileSync(join(SPEC, 'SPEC.md'), 'utf8');
    const blocks = [...spec.matchAll(/```yaml\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const block of blocks) {
      const yaml = block.replace(/^#.*\n/, '').replace(/^---\n/, '').replace(/\n---\n[\s\S]*$/, '\n');
      const parsed = parseYaml(yaml) as Record<string, unknown>;
      const fm = ['schema', 'schemas', 'edgeTypes', 'prefixes', 'tgs'].some((k) => k in parsed) ? parsed : { schema: parsed };
      expect(validateJson(fm), JSON.stringify(validateJson.errors)).toBe(true);
      expect(readSchemaNote('Types/Example.md', fm).diagnostics).toEqual([]);
    }
    expect(validateJson(parseYaml(splitFrontmatter(scaffoldSchemaNote()).yaml!))).toBe(true);
  });

  // @lat: [[tests/tgs-spec#Invalid notes rejected]]
  it('rejects malformed declarations', () => {
    for (const bad of [{ schema: { edges: 5 } }, { schema: { properties: { a: { kind: 'emotion' } } } }, { schemas: { A: { inherits: 'B' } } }, { tgs: '1.0' }, { edgeTypes: { e: { from: 3 } } }]) {
      expect(validateJson(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  // @lat: [[tests/tgs-spec#Namespace terms documented]]
  it('documents every tgs: term the SHACL export uses', () => {
    const ns = JSON.parse(readFileSync(join(SPEC, 'namespace.json'), 'utf8')) as { namespace: string; terms: { term: string }[] };
    const used = new Set<string>();
    const src = ['export.ts', 'import.ts'].map((f) => readFileSync(join(__dirname, '../src/shacl', f), 'utf8')).join('\n');
    for (const m of src.matchAll(/\$\{TGS\}(\w+)/g)) used.add(m[1]!);
    expect([...used].sort()).toEqual(ns.terms.map((t) => t.term).sort());
    expect(ns.namespace).toBe('https://volland.github.io/obsigraph/ns/tgs#');
  });
});
