import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  compareLuhmann,
  expandTokens,
  findLuhmannParent,
  Graph,
  luhmannChild,
  luhmannRoot,
  luhmannSibling,
  planNewNote,
  readSchemaNote,
  schemasFromGraph,
  splitFrontmatter,
  timestampId,
  uuid4,
  uuid7,
  type NoteInput,
  type TypeSchema,
} from '../src/index.js';

const rng = (seed: number) => (n: number) => Uint8Array.from({ length: n }, (_, i) => (seed * 31 + i * 17) & 0xff);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-([89ab])[0-9a-f]{3}-[0-9a-f]{12}$/;
const set = (...ids: string[]) => new Set(ids);

function note(path: string, fm: Record<string, unknown>, body = ''): NoteInput {
  const text = `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n${body}`;
  return { path, text, frontmatter: fm };
}

function graphOf(notes: NoteInput[]): Graph {
  const paths = new Set(notes.map((n) => n.path));
  const g = new Graph((l) => [...paths].find((p) => p === `${l}.md` || p.endsWith(`/${l}.md`)) ?? null);
  for (const n of notes) g.upsertNote(n);
  return g;
}

const TYPES = note('Types/Idea.md', {
  tgs: '0.2',
  schemas: {
    Idea: { id: [{ kind: 'uuid7', property: 'uid' }, { kind: 'luhmann', property: 'luhmann' }], properties: { status: { values: ['open'], default: 'open' } } },
    Stamped: { id: { kind: 'timestamp', property: 'stamp', filename: true } },
  },
});

function schemaOf(notes: NoteInput[], type: string): { schema: TypeSchema; graph: Graph } {
  const graph = graphOf(notes);
  return { schema: schemasFromGraph(graph, 'Types/').schemas.get(type)!, graph };
}

describe('generated ids', () => {
  // @lat: [[tests/new-notes#Generated ids#UUID versions]]
  it('makes version 4 and version 7 UUIDs with the clock in the first 48 bits', () => {
    const a = uuid4(rng(1));
    expect(a).toMatch(UUID);
    expect(UUID.exec(a)![1]).toBe('4');
    const now = new Date('2026-10-08T12:00:00.000Z');
    const b = uuid7(now, rng(2));
    expect(b).toMatch(UUID);
    expect(UUID.exec(b)![1]).toBe('7');
    expect(parseInt(b.replace(/-/g, '').slice(0, 12), 16)).toBe(now.getTime());
  });

  // @lat: [[tests/new-notes#Generated ids#Time-ordered ids sort]]
  it('sorts version 7 ids by creation time as plain strings', () => {
    const ids = [0, 1, 1000, 86_400_000, 31_536_000_000].map((d, i) => uuid7(new Date(1_790_000_000_000 + d), rng(i)));
    expect([...ids].sort()).toEqual(ids);
  });

  // @lat: [[tests/new-notes#Generated ids#Timestamp id skips taken minutes]]
  it('writes a local YYYYMMDDHHmm and moves on while it is taken', () => {
    const now = new Date(2026, 0, 12, 15, 30, 45);
    expect(timestampId(now, set())).toBe('202601121530');
    expect(timestampId(now, set('202601121530', '202601121531'))).toBe('202601121532');
  });

  // @lat: [[tests/new-notes#Generated ids#Luhmann siblings]]
  it('finds the next free Luhmann sibling', () => {
    expect(luhmannSibling('1a', set())).toBe('1b');
    expect(luhmannSibling('1z', set())).toBe('1aa');
    expect(luhmannSibling('3', set())).toBe('4');
    expect(luhmannSibling('1a', set('1b', '1c'))).toBe('1d');
    expect(luhmannSibling('1a2', set())).toBe('1a3');
  });

  // @lat: [[tests/new-notes#Generated ids#Luhmann children]]
  it('finds the next free Luhmann child', () => {
    expect(luhmannChild('1', set())).toBe('1a');
    expect(luhmannChild('1a', set())).toBe('1a1');
    expect(luhmannChild('1', set('1a'))).toBe('1b');
    expect(luhmannChild('1a1', set('1a1a', '1a1b'))).toBe('1a1c');
    expect(() => luhmannChild('a1', set())).toThrow();
  });

  // @lat: [[tests/new-notes#Generated ids#Luhmann roots and order]]
  it('numbers roots after the largest and orders ids as a slip box shelves them', () => {
    expect(luhmannRoot(set())).toBe('1');
    expect(luhmannRoot(set('1', '1a', '9', '10b'))).toBe('11');
    expect(['10', '2', '1b', '1a1', '1', '1a'].sort(compareLuhmann)).toEqual(['1', '1a', '1a1', '1b', '2', '10']);
  });
});

describe('the id key', () => {
  const read = (id: unknown) => readSchemaNote('Types/T.md', { schema: { id } });

  // @lat: [[tests/new-notes#The id key#Id key forms]]
  it('reads a bare kind, a mapping and a list', () => {
    expect(read('uuid7').types[0]!.ids).toEqual([{ kind: 'uuid7', property: 'id', auto: true, filename: false }]);
    expect(read({ kind: 'luhmann', property: 'path' }).types[0]!.ids).toEqual([{ kind: 'luhmann', property: 'path', auto: false, filename: false }]);
    const list = read([{ kind: 'uuid', property: 'uid' }, { kind: 'timestamp', property: 'stamp', filename: true, auto: false }]).types[0]!.ids;
    expect(list.map((r) => [r.property, r.auto, r.filename])).toEqual([['uid', true, false], ['stamp', false, true]]);
  });

  // @lat: [[tests/new-notes#The id key#Id property is implied]]
  it('declares an undeclared id property as text', () => {
    const t = read({ kind: 'uuid', property: 'uid' }).types[0]!;
    expect(t.properties.find((p) => p.name === 'uid')).toMatchObject({ kind: 'text', required: false });
  });

  // @lat: [[tests/new-notes#The id key#Invalid id declarations]]
  it('reports and ignores invalid id declarations', () => {
    expect(read('snowflake').diagnostics.map((d) => d.message).join('|')).toMatch(/kind 'snowflake'/);
    expect(read({ kind: 'uuid', color: 'red' }).diagnostics.map((d) => d.message).join('|')).toMatch(/Unknown key 'color'/);
    const listless = read(['uuid']);
    expect(listless.types[0]!.ids).toEqual([]);
    expect(listless.diagnostics.map((d) => d.message).join('|')).toMatch(/must name its `property`/);
    const twice = read([{ kind: 'uuid', property: 'a' }, { kind: 'uuid7', property: 'a' }]);
    expect(twice.types[0]!.ids).toHaveLength(1);
    expect(twice.diagnostics.map((d) => d.message).join('|')).toMatch(/declared twice/);
  });
});

describe('planning a note', () => {
  const now = new Date(2026, 0, 12, 15, 30);
  const base = [TYPES, note('Ideas/Root.md', { type: 'Idea', luhmann: '1', uid: 'x' }), note('Ideas/Leaf.md', { type: 'Idea', luhmann: '1a' })];

  // @lat: [[tests/new-notes#Planning a note#Ids and tokens]]
  it('puts automatic ids in the frontmatter and the template, and leaves other braces alone', () => {
    const { schema, graph } = schemaOf(base, 'Idea');
    const plan = planNewNote({ schema, title: 'Fresh', linkedBody: 'Id {{uid}} / {{id}} on {{date}} for {{title}}\n{{edge: A -b-> C . d}} {{luhmann}}', schemaBody: '', graph, now, random: rng(3) });
    expect(Object.keys(plan.ids)).toEqual(['uid']);
    expect(plan.ids.uid).toMatch(UUID);
    expect(plan.content.startsWith(`---\ntype: Idea\nuid: ${plan.ids.uid}\n`)).toBe(true);
    expect(plan.content).toContain(`Id ${plan.ids.uid} / ${plan.ids.uid} on 2026-01-12 for Fresh\n{{edge: A -b-> C . d}} {{luhmann}}`);
    expect(plan.fileName).toBe('Fresh.md');
    expect(splitFrontmatter(plan.content).yaml).toContain('status: open');
  });

  // @lat: [[tests/new-notes#Planning a note#Luhmann placement]]
  it('gives a child or sibling the next free Luhmann id and fills the parent tokens', () => {
    const { schema, graph } = schemaOf(base, 'Idea');
    const set2 = schemasFromGraph(graph, 'Types/');
    const parent = findLuhmannParent(graph, set2, 'Ideas/Root.md')!;
    expect(parent).toMatchObject({ id: '1', property: 'luhmann', title: 'Root', type: 'Idea' });
    const body = 'follows:: {{parent-link}} {luhmann: "{{luhmann}}"} ({{parent}}, {{parent-id}})';
    const child = planNewNote({ schema, title: 'Child', linkedBody: body, schemaBody: '', graph, parent: { ...parent, placement: 'child' }, now, random: rng(4) });
    expect(child.ids.luhmann).toBe('1b');
    expect(child.content).toContain('follows:: [[Root]] {luhmann: "1b"} (Root, 1)');
    const sibling = planNewNote({ schema, title: 'Sib', linkedBody: body, schemaBody: '', graph, parent: { ...parent, placement: 'sibling' }, now, random: rng(5) });
    expect(sibling.ids.luhmann).toBe('2');
    expect(findLuhmannParent(graph, set2, 'Missing.md')).toBeNull();
  });

  // @lat: [[tests/new-notes#Planning a note#Lines without a parent are dropped]]
  it('drops template lines that mention the parent when there is none', () => {
    expect(expandTokens('keep\nfollows:: {{parent-link}}\nalso {{parent}} here\nend', { title: 'T' })).toBe('keep\nend');
    expect(expandTokens('a {{title}}', { title: 'T' })).toBe('a T');
    const { schema, graph } = schemaOf(base, 'Idea');
    const plan = planNewNote({ schema, title: 'Alone', linkedBody: '## Links\n\nfollows:: {{parent-link}}\n', schemaBody: '', graph, luhmann: true, now, random: rng(6) });
    expect(plan.content).not.toContain('follows');
    expect(plan.ids.luhmann).toBe('2');
  });

  // @lat: [[tests/new-notes#Planning a note#File name carries the id]]
  it('prefixes the file name with an id when the rule says so', () => {
    const { schema, graph } = schemaOf([TYPES], 'Stamped');
    const plan = planNewNote({ schema, title: 'Thought', linkedBody: null, schemaBody: '', graph, now });
    expect(plan.fileName).toBe('202601121530 Thought.md');
    expect(plan.content).toContain('stamp: "202601121530"');
  });
});

const ROOT = join(__dirname, '../../../ontologies/zettelkasten');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
}

describe('the Zettelkasten ontology', () => {
  // @lat: [[tests/new-notes#Zettelkasten ontology#Zettelkasten ids and templates]]
  it('gives every type a uid, permanent notes a Luhmann id, and note types templates that make valid notes', () => {
    const notes: NoteInput[] = files(ROOT)
      .filter((f) => f.endsWith('.md') && !f.endsWith('README.md'))
      .map((f) => {
        const text = readFileSync(f, 'utf8');
        const { yaml } = splitFrontmatter(text);
        return { path: relative(ROOT, f), text, frontmatter: yaml === null ? null : (parseYaml(yaml) as Record<string, unknown>) };
      });
    const core = files(join(ROOT, '../core')).filter((f) => f.endsWith('.md') && !f.endsWith('README.md')).map((f) => ({ path: relative(join(ROOT, '../core'), f), text: readFileSync(f, 'utf8'), frontmatter: parseYaml(splitFrontmatter(readFileSync(f, 'utf8')).yaml ?? '') as Record<string, unknown> }));
    const graph = graphOf([...notes, ...core]);
    const types = schemasFromGraph(graph, 'Types/');
    expect(types.diagnostics).toEqual([]);
    for (const t of types.schemas.values()) expect(t.ids.some((r) => r.property === 'uid' && r.kind === 'uuid7' && r.auto), t.type).toBe(true);
    const permanent = types.schemas.get('PermanentNote')!;
    expect(permanent.ids.find((r) => r.kind === 'luhmann')).toMatchObject({ property: 'luhmann', auto: false });
    const read = (p: string | null) => (p ? notes.find((n) => n.path === p) : undefined);
    const resolve = (link: string) => notes.find((n) => n.path === `${link}.md`)?.path ?? null;
    for (const name of ['FleetingNote', 'LiteratureNote', 'PermanentNote', 'StructureNote', 'ProjectNote']) {
      const schema = types.schemas.get(name)!;
      expect(schema.template, name).toBeTruthy();
      const path = schema.template!.replace(/^\[\[|\]\]$/g, '');
      const linked = read(resolve(path) ?? `${path}.md`);
      expect(linked, `${name} template`).toBeTruthy();
      const parent = findLuhmannParent(graph, types, 'Examples/Notes are only useful when linked.md')!;
      const plan = planNewNote({ schema, title: 'Brand new', linkedBody: splitFrontmatter(linked!.text).body, schemaBody: '', graph, parent: name === 'PermanentNote' ? { ...parent, placement: 'child' } : undefined, now: new Date(2026, 5, 1, 9, 0) });
      const fresh = { path: `Examples/Brand new ${name}.md`, text: plan.content, frontmatter: parseYaml(splitFrontmatter(plan.content).yaml ?? '') as Record<string, unknown> };
      expect(fresh.frontmatter.uid).toMatch(UUID);
      if (name === 'PermanentNote') {
        expect(fresh.frontmatter.luhmann).toBe('1b');
        expect(plan.content).toContain('follows:: [[Notes are only useful when linked]] {luhmann: "1b"}');
      }
      expect(plan.content).not.toMatch(/\{\{\s*[a-z-]+\s*\}\}/);
    }
  });
});
