import { describe, expect, it } from 'vitest';
import { frontmatterEdges, Graph, validateVault, type NoteInput } from '../src/index.js';

const vault = (notes: NoteInput[], options?: { frontmatterEdges?: boolean }) => {
  const paths = new Set(notes.map((n) => n.path));
  const graph = new Graph((link) => (paths.has(`${link}.md`) ? `${link}.md` : null), undefined, options);
  for (const n of notes) graph.upsertNote(n);
  return graph;
};

const note = (path: string, frontmatter: Record<string, unknown> | null = null, text = ''): NoteInput => ({ path, text, frontmatter });

describe('frontmatter edges', () => {
  // @tg: verifies:: [[tests/frontmatter-edges#Links become typed edges]] {since: "2026-10-13", level: unit}
  // @lat: [[tests/frontmatter-edges#Links become typed edges]]
  // @tg: verifies:: [[openspec:edge-parsing#Frontmatter link edges#Single and list values]]
  // @tg: verifies:: [[openspec:edge-parsing#Frontmatter link edges#Alias, subpath and markdown links]]
  it('turns wikilinks in property values into edges typed by the property name', () => {
    const edges = frontmatterEdges(
      {
        requirement: '[[Login]]',
        topics: ['[[Security|sec]]', '[[Auth#Flow]]', '[Docs](docs/Guide.md)'],
        nested: [['[[Deep]]']],
      },
      'Tasks/T1.md',
    );
    expect(edges.map((e) => [e.type, e.target, e.subpath, e.alias])).toEqual([
      ['requirement', 'Login', null, null],
      ['topics', 'Security', null, 'sec'],
      ['topics', 'Auth', 'Flow', null],
      ['topics', 'Tasks/docs/Guide.md', null, 'Docs'],
      ['nested', 'Deep', null, null],
    ]);
    expect(edges.every((e) => e.sign === 1 && e.line === 0 && e.heading === null && Object.keys(e.props).length === 0)).toBe(true);
  });

  // @tg: verifies:: [[tests/frontmatter-edges#Only links count]] {since: "2026-10-13", level: unit}
  // @lat: [[tests/frontmatter-edges#Only links count]]
  // @tg: verifies:: [[openspec:edge-parsing#Frontmatter link edges#Values without links and skipped properties]]
  it('ignores text, numbers, empty placeholders and Obsidian-owned properties', () => {
    expect(
      frontmatterEdges({
        owner: 'bob',
        estimate: 3,
        done: false,
        feature: '[[]]',
        none: null,
        tags: ['[[tag]]'],
        aliases: ['[[alias]]'],
        cssclasses: '[[css]]',
        type: '[[Task]]',
        types: ['[[Task]]'],
      }),
    ).toEqual([]);
    expect(frontmatterEdges(null)).toEqual([]);
    expect(frontmatterEdges(undefined)).toEqual([]);
  });

  // @tg: verifies:: [[tests/frontmatter-edges#Off unless enabled]] {since: "2026-10-13", level: unit}
  // @lat: [[tests/frontmatter-edges#Off unless enabled]]
  // @tg: verifies:: [[openspec:edge-parsing#Frontmatter link edges#Off by default]]
  it('adds graph edges only when the option is on', () => {
    const notes = [note('Login.md'), note('Task.md', { type: 'Task', requirement: '[[Login]]' })];
    expect([...vault(notes).edges()]).toEqual([]);
    expect([...vault(notes, { frontmatterEdges: true }).edges()]).toEqual([
      { id: 'Task.md#requirement#Login.md#0', type: 'requirement', sign: 1, source: 'Task.md', target: 'Login.md', props: {}, heading: null, line: 0 },
    ]);
  });

  // @tg: verifies:: [[tests/frontmatter-edges#Alongside body edges]] {since: "2026-10-13", level: unit}
  // @lat: [[tests/frontmatter-edges#Alongside body edges]]
  // @tg: verifies:: [[openspec:edge-parsing#Frontmatter link edges#Alongside body edges]]
  it('keeps body edges and gives repeated links distinct ids', () => {
    const g = vault([note('A.md'), note('B.md', { related: ['[[A]]', '[[A]]'] }, 'related:: [[A]]')], { frontmatterEdges: true });
    expect([...g.edges()].map((e) => e.id)).toEqual(['B.md#related#A.md#0', 'B.md#related#A.md#1', 'B.md#related#A.md#2']);
  });

  // @tg: verifies:: [[tests/frontmatter-edges#Follows edits and unresolved links]] {since: "2026-10-13", level: unit}
  // @lat: [[tests/frontmatter-edges#Follows edits and unresolved links]]
  // @tg: verifies:: [[openspec:edge-parsing#Frontmatter link edges#Follows note edits]]
  it('updates edges when the note changes and stubs unresolved targets', () => {
    const g = vault([note('Task.md', { requirement: '[[Ghost]]' })], { frontmatterEdges: true });
    expect(g.node('Ghost')).toMatchObject({ stub: true });
    g.upsertNote(note('Task.md', { requirement: '[[Other]]' }));
    expect([...g.edges()].map((e) => e.target)).toEqual(['Other']);
    expect(g.node('Ghost')).toBeUndefined();
    g.upsertNote(note('Task.md', { owner: 'bob' }));
    expect([...g.edges()]).toEqual([]);
  });

  // @tg: verifies:: [[tests/frontmatter-edges#Schemas check frontmatter edges]] {since: "2026-10-13", level: unit}
  // @lat: [[tests/frontmatter-edges#Schemas check frontmatter edges]]
  // @tg: verifies:: [[openspec:edge-parsing#Frontmatter link edges#Schema checks apply]]
  it('lets edge type declarations check frontmatter links', () => {
    const notes = [
      { path: 'Types/Edges.md', text: '', frontmatter: { edgeTypes: { requirement: { from: ['Task'], to: ['Requirement'] } } } },
      note('Login.md', { type: 'Requirement' }),
      note('Bug1.md', { type: 'Bug' }),
      note('Good.md', { type: 'Task', requirement: '[[Login]]' }),
      note('Bad.md', { type: 'Task', requirement: '[[Bug1]]' }),
    ];
    expect(validateVault(notes).map((f) => f.code)).toEqual([]);
    const found = validateVault(notes, { frontmatterEdges: true });
    expect(found.map((f) => [f.code, f.path])).toEqual([['wrong-target-type', 'Bad.md']]);
  });
});
