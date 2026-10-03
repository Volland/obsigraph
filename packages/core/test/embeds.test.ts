import { describe, expect, it } from 'vitest';
import { EmbedIndex, findEmbeds, Graph, parseEmbed, resolveEmbed, viewEmbed, type NoteInput } from '../src/index.js';

function vault(notes: NoteInput[]) {
  const paths = new Set(notes.map((n) => n.path));
  const graph = new Graph((l) => (paths.has(`${l}.md`) ? `${l}.md` : null));
  for (const n of notes) graph.upsertNote(n);
  return graph;
}

const people = (alice: string) =>
  vault([
    { path: 'Alice.md', text: alice },
    { path: 'Bob.md', text: '' },
    { path: 'Eve.md', text: '' },
  ]);

/** Render one embed as the plugin would. */
const show = (graph: Graph, raw: string, from = 'Notes.md') => {
  const e = parseEmbed(raw);
  if (typeof e === 'string') throw new Error(e);
  return viewEmbed(e, resolveEmbed(graph, e, from));
};

describe('edge embeds', () => {
  // @lat: [[tests/edge-embeds#Value by endpoints]]
  it('renders a property value found by source, type and target', () => {
    const graph = people('knows:: [[Bob]] {since: 2020}');
    expect(show(graph, 'Alice -knows-> Bob . since')).toEqual({ kind: 'value', text: '2020' });
    expect(show(graph, '[[Alice]] -knows-> [[Bob|Bobby]] . since')).toEqual({ kind: 'value', text: '2020' });
  });

  // @lat: [[tests/edge-embeds#Signed type]]
  it('matches negative edges with an explicit or omitted sign', () => {
    const graph = people('-distrusts:: [[Eve]] {since: 2019}');
    expect(show(graph, 'Alice --distrusts-> Eve . since')).toEqual({ kind: 'value', text: '2019' });
    expect(show(graph, 'Alice -distrusts-> Eve . since')).toEqual({ kind: 'value', text: '2019' });
  });

  // @lat: [[tests/edge-embeds#Sign mismatch unresolved]]
  it('does not resolve when the embed sign differs from the edge sign', () => {
    const graph = people('knows:: [[Bob]] {since: 2020}');
    expect(show(graph, 'Alice --knows-> Bob . since')).toEqual({ kind: 'unresolved', text: 'edge not found: Alice --knows-> Bob' });
    expect(show(graph, 'Alice -+knows-> Bob . since').kind).toBe('value');
  });

  // @lat: [[tests/edge-embeds#Value by pinned id]]
  it('resolves by pinned id and names unknown ids', () => {
    const graph = people('knows:: [[Bob]] {id: "met-2020", since: 2020}');
    expect(show(graph, 'met-2020 . since')).toEqual({ kind: 'value', text: '2020' });
    expect(show(graph, 'nope-1 . since')).toEqual({ kind: 'unresolved', text: "no edge with id 'nope-1'" });
  });

  // @lat: [[tests/edge-embeds#Whole block as table]]
  it('renders the whole property block as a table, or an empty state', () => {
    const graph = people('knows:: [[Bob]] {id: "met-2020", since: 2020, label: "met at conf"}\nlikes:: [[Eve]]');
    expect(show(graph, 'met-2020')).toEqual({ kind: 'table', rows: [['id', 'met-2020'], ['since', '2020'], ['label', 'met at conf']] });
    expect(show(graph, 'Alice -likes-> Eve')).toEqual({ kind: 'empty', text: 'no properties' });
  });

  // @lat: [[tests/edge-embeds#Missing property or edge]]
  it('marks a missing property or edge as unresolved without throwing', () => {
    const graph = people('knows:: [[Bob]]');
    expect(show(graph, 'Alice -knows-> Bob . since')).toEqual({ kind: 'unresolved', text: "edge has no property 'since'" });
    expect(show(graph, 'Alice -hates-> Bob')).toEqual({ kind: 'unresolved', text: 'edge not found: Alice -hates-> Bob' });
    expect(show(graph, 'Nobody -knows-> Bob').kind).toBe('unresolved');
    expect(parseEmbed('Alice -knows Bob')).toMatch(/Edge id 'Alice -knows Bob' cannot contain spaces/);
  });

  // @lat: [[tests/edge-embeds#Ambiguous endpoints]]
  it('renders the first of duplicate edges and warns about ambiguity', () => {
    const graph = people('knows:: [[Bob]] {since: 2020}\nknows:: [[Bob]] {since: 2023}');
    expect(show(graph, 'Alice -knows-> Bob . since')).toEqual({ kind: 'value', text: '2020' });
    const idx = new EmbedIndex();
    idx.upsert('Notes.md', 'met {{edge: Alice -knows-> Bob . since}}');
    expect(idx.warnings(graph).map((d) => d.message)).toContainEqual(expect.stringMatching(/^2 edges match \{\{edge: Alice -knows-> Bob \. since\}\}/));
  });

  // @lat: [[tests/edge-embeds#Pinned id warnings]]
  it('warns only for unpinned edges referenced by endpoints, suggesting an id', () => {
    const graph = people('knows:: [[Bob]] {since: 2020}\nlikes:: [[Eve]] {id: "a-likes-e"}\ntrusts:: [[Eve]]');
    const idx = new EmbedIndex();
    idx.upsert('Notes.md', ['intro', '{{edge: Alice -knows-> Bob . since}}', '{{edge: Alice -likes-> Eve}}', '{{edge: a-likes-e}}'].join('\n'));
    const warnings = idx.warnings(graph);
    expect(warnings).toEqual([
      {
        path: 'Notes.md',
        line: 1,
        column: 0,
        message: '{{edge: Alice -knows-> Bob . since}} refers to an unpinned edge in Alice.md line 1; add {id: "alice-knows-bob"} to keep the reference stable',
      },
    ]);
  });

  // @lat: [[tests/edge-embeds#Live value refresh]]
  it('shows the new value after the edge is edited', () => {
    const graph = people('knows:: [[Bob]] {since: 2020}');
    expect(show(graph, 'Alice -knows-> Bob . since')).toEqual({ kind: 'value', text: '2020' });
    graph.upsertNote({ path: 'Alice.md', text: 'knows:: [[Bob]] {since: 2021}' });
    expect(show(graph, 'Alice -knows-> Bob . since')).toEqual({ kind: 'value', text: '2021' });
  });

  // @lat: [[tests/edge-embeds#Embeds outside code only]]
  it('finds embeds outside fenced and inline code, and reports malformed ones', () => {
    const text = ['a {{edge: x . y}} b', '`{{edge: inline}}`', '```', '{{edge: fenced}}', '```', '{{ edge:  }}'].join('\n');
    const found = findEmbeds(text);
    expect(found.map((f) => [f.line, f.column, f.raw])).toEqual([
      [0, 2, '{{edge: x . y}}'],
      [5, 0, '{{ edge:  }}'],
    ]);
    expect(found[0]!.embed).toEqual({ kind: 'id', id: 'x', prop: 'y' });
    expect(found[1]!.error).toBe('Empty edge embed');
    const idx = new EmbedIndex();
    idx.upsert('N.md', '{{ edge:  }}');
    expect(idx.warnings(new Graph(() => null))[0]!.message).toMatch(/Malformed edge embed/);
  });
});
