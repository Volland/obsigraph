import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { checkOkf, exportOkf, Graph, schemasFromGraph, splitFrontmatter, validateSchemas, type NoteInput } from '../src/index.js';
import { exportShacl } from '../src/shacl.js';

const ROOT = join(__dirname, '../../../ontologies');
const ALL = readdirSync(ROOT).filter((f) => statSync(join(ROOT, f)).isDirectory()).sort();
/** The ontologies you pick from; `core` is the shared base they build on. */
const IDS = ALL.filter((id) => id !== 'core');
const validateJson = new Ajv({ strict: true, allowUnionTypes: true }).compile(JSON.parse(readFileSync(join(__dirname, '../../../spec/tgs/tgs.schema.json'), 'utf8')));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
}

/** The notes of one gallery ontology; `README.md` is documentation and is left out. */
function load(id: string): NoteInput[] {
  const dir = join(ROOT, id);
  return files(dir)
    .filter((f) => f.endsWith('.md') && !f.endsWith('README.md'))
    .sort()
    .map((f) => {
      const text = readFileSync(f, 'utf8');
      const { yaml } = splitFrontmatter(text);
      return { path: relative(dir, f), text, frontmatter: yaml === null ? null : (parseYaml(yaml) as Record<string, unknown>) };
    });
}

function check(notes: NoteInput[]) {
  const paths = new Set(notes.map((n) => n.path));
  const graph = new Graph((l) => [...paths].find((p) => p === `${l}.md` || p.endsWith(`/${l}.md`)) ?? null);
  for (const n of notes) graph.upsertNote(n);
  const set = schemasFromGraph(graph, 'Types/');
  return { set, diagnostics: [...set.diagnostics, ...validateSchemas(graph, set)].map((d) => `${d.path}:${d.line ?? ''} ${d.message}`) };
}

describe('ontology gallery', () => {
  it('has the five ontologies and the shared core', () => {
    expect(ALL).toEqual(['agents', 'core', 'library', 'okf', 'requirements', 'zettelkasten']);
  });

  // @lat: [[tests/ontology-gallery#Each ontology stands alone]]
  it.each(IDS)('%s reads, validates its examples, exports to SHACL and matches the JSON Schema', (id) => {
    const notes = load(id);
    const { set, diagnostics } = check(notes);
    expect(diagnostics).toEqual([]);
    expect(set.schemas.size).toBeGreaterThanOrEqual(3);
    expect(set.edgeTypes.size).toBeGreaterThanOrEqual(5);
    for (const n of notes.filter((x) => x.path.startsWith('Types/'))) expect(validateJson(n.frontmatter ?? {}), JSON.stringify(validateJson.errors)).toBe(true);
    const bodies = new Map(notes.map((n) => [n.path, splitFrontmatter(n.text).body]));
    expect(exportShacl(set, { body: (p) => bodies.get(p) ?? null })).toContain('sh:NodeShape');
  });

  it('core declares the shared edge types and nothing else', () => {
    const { set, diagnostics } = check(load('core'));
    expect(diagnostics).toEqual([]);
    expect([...set.edgeTypes.keys()].sort()).toEqual(['contradicts', 'derived_from']);
    expect(set.schemas.size).toBe(0);
  });

  // @lat: [[tests/ontology-gallery#Ontologies compose]]
  it('combines into one vault with no clash, and a note can carry labels from two ontologies', () => {
    const merged = ALL.flatMap((id) => load(id).map((n) => ({ ...n, path: n.path.startsWith('Types/') ? n.path : `${id}/${n.path}` })));
    const both: NoteInput = {
      path: 'Shared/Thinking in Systems.md',
      text: '---\ntype: [Book, Source]\nauthor: Donella Meadows\nstatus: finished\n---\n## Links\n\nwritten_by:: [[Donella Meadows]]\n',
      frontmatter: { type: ['Book', 'Source'], author: 'Donella Meadows', status: 'finished' },
    };
    const author: NoteInput = { path: 'Shared/Donella Meadows.md', text: '---\ntype: Author\n---\n', frontmatter: { type: 'Author' } };
    const zettel: NoteInput = {
      path: 'Shared/Leverage points.md',
      text: '---\ntype: Zettel\n---\n## Links\n\ncites:: [[Thinking in Systems]] {page: "145"}\n',
      frontmatter: { type: 'Zettel' },
    };
    const { set, diagnostics } = check([...merged, both, author, zettel]);
    expect(diagnostics).toEqual([]);
    expect(set.schemas.size).toBe(IDS.reduce((n, id) => n + check(load(id)).set.schemas.size, 0));
    expect(set.edgeTypes.has('contradicts')).toBe(true);
  });

  // @lat: [[tests/ontology-gallery#Clash without core]]
  it('reports the duplicate edge type when two ontologies both declare it', () => {
    const dup: NoteInput = {
      path: 'Types/Extra.md',
      text: '---\nedgeTypes:\n  contradicts: {from: Zettel}\n---\n',
      frontmatter: { edgeTypes: { contradicts: { from: 'Zettel' } } },
    };
    const { diagnostics } = check([...ALL.flatMap((id) => load(id)), dup]);
    expect(diagnostics.some((d) => /Edge type 'contradicts' is declared in both/.test(d))).toBe(true);
  });

  // @lat: [[tests/ontology-gallery#Mixin bridges two ontologies]]
  it('lets a mixin type grant an edge across ontologies, and rejects it without the mixin', () => {
    const merged = ALL.flatMap((id) => load(id).map((n) => ({ ...n, path: n.path.startsWith('Types/') ? n.path : `${id}/${n.path}` })));
    const bridge: NoteInput = {
      path: 'Types/Bridge.md',
      text: '---\nschemas:\n  Traceable:\n    edges:\n      implements: Requirement\nedgeTypes:\n  implements: {to: Requirement}\n---\n',
      frontmatter: { schemas: { Traceable: { edges: { implements: 'Requirement' } } }, edgeTypes: { implements: { to: 'Requirement' } } },
    };
    const prompt = (types: string[]): NoteInput => ({
      path: 'Shared/Expiry prompt.md',
      text: `---\ntype: [${types.join(', ')}]\npurpose: Explain token expiry\n---\n## Links\n\nimplements:: [[Tokens expire after 15 minutes]]\n`,
      frontmatter: { type: types, purpose: 'Explain token expiry' },
    });
    expect(check([...merged, bridge, prompt(['Prompt', 'Traceable'])]).diagnostics).toEqual([]);
    const without = check([...merged, bridge, prompt(['Prompt'])]).diagnostics;
    expect(without.some((d) => /'implements' is not allowed for/.test(d))).toBe(true);
  });

  // @lat: [[tests/ontology-gallery#OKF ontology exports conformant]]
  it('exports the OKF ontology as a bundle with no conformance errors', () => {
    const notes = load('okf').filter((n) => n.path.startsWith('Examples/'));
    const { files } = exportOkf(notes.map((n) => ({ path: n.path, text: n.text, frontmatter: n.frontmatter ?? null })));
    const bundle = files.map((f) => {
      const { yaml } = splitFrontmatter(f.text);
      return { ...f, frontmatter: yaml === null ? null : (parseYaml(yaml) as Record<string, unknown>) };
    });
    expect(checkOkf(bundle).filter((f) => f.severity === 'error')).toEqual([]);
    expect(files.find((f) => f.path === 'Examples/orders.md')!.text).toContain('derived_from:: [raw_orders](/Examples/raw_orders.md)');
  });
});
