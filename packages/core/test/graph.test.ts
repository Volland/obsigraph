import { describe, expect, it } from 'vitest';
import { Graph, type NoteInput } from '../src/index.js';

/** A tiny vault: resolver maps link text to `<text>.md` when that note exists. */
function vault() {
  const existing = new Set<string>();
  const graph = new Graph((link) => {
    const p = link.endsWith('.md') ? link : `${link}.md`;
    return existing.has(p) ? p : null;
  });
  const put = (note: NoteInput) => {
    existing.add(note.path);
    graph.upsertNote(note);
  };
  const del = (path: string) => {
    existing.delete(path);
    graph.removeNote(path);
  };
  return { graph, put, del, existing };
}

describe('graph model', () => {
  // @lat: [[tests/graph-store#One node per note]]
  // @tg: verifies:: [[openspec:graph-model#One note is one node#Note with headings]]
  it('creates exactly one node per note regardless of headings', () => {
    const { graph, put } = vault();
    put({ path: 'Alice.md', text: '# A\n## B\n### C\nknows:: [[Bob]]\nlikes:: [[Bob]]' });
    expect([...graph.nodes()].filter((n) => !n.stub).map((n) => n.id)).toEqual(['Alice.md']);
  });

  // @lat: [[tests/graph-store#Stub for unresolved link]]
  // @tg: verifies:: [[openspec:graph-model#Stub nodes for unresolved links#Link to missing note]]
  it('creates a stub node for an unresolved target', () => {
    const { graph, put } = vault();
    put({ path: 'Alice.md', text: 'knows:: [[Nobody]]' });
    const stub = graph.node('Nobody');
    expect(stub).toMatchObject({ stub: true, props: { title: 'Nobody' } });
    expect(graph.outEdges('Alice.md')[0]!.target).toBe('Nobody');
  });

  // @lat: [[tests/graph-store#Stub promoted when note created]]
  // @tg: verifies:: [[openspec:graph-model#Stub nodes for unresolved links#Stub becomes real]]
  it('replaces the stub with the real node when the note appears', () => {
    const { graph, put } = vault();
    put({ path: 'Alice.md', text: 'knows:: [[Nobody]]' });
    const changed: string[][] = [];
    graph.onChange((p) => changed.push(p));
    put({ path: 'Nobody.md', text: '' });
    expect(graph.node('Nobody')).toBeUndefined();
    expect(graph.outEdges('Alice.md')[0]!.target).toBe('Nobody.md');
    expect(graph.inEdges('Nobody.md')).toHaveLength(1);
    expect(changed[0]).toEqual(expect.arrayContaining(['Nobody.md', 'Alice.md']));
  });

  // @lat: [[tests/graph-store#Labels from frontmatter type]]
  // @tg: verifies:: [[openspec:graph-model#Node labels from frontmatter#Multiple types]]
  it('derives labels from a string or list type', () => {
    const { graph, put } = vault();
    put({ path: 'Ann.md', text: '', frontmatter: { type: ['Person', 'Employee'] } });
    put({ path: 'Bob.md', text: '', frontmatter: { type: 'Person' } });
    put({ path: 'Raw.md', text: '' });
    expect(graph.node('Ann.md')!.labels).toEqual(['Person', 'Employee']);
    expect(graph.node('Bob.md')!.labels).toEqual(['Person']);
    expect(graph.node('Raw.md')!.labels).toEqual([]);
  });

  // @lat: [[tests/graph-store#Frontmatter path and title properties]]
  // @tg: verifies:: [[openspec:graph-model#Node properties#Frontmatter property]]
  it('exposes frontmatter, path and title as node properties', () => {
    const { graph, put } = vault();
    put({ path: 'People/Ann.md', text: '', frontmatter: { age: 31 } });
    expect(graph.node('People/Ann.md')!.props).toMatchObject({ age: 31, path: 'People/Ann.md', title: 'Ann' });
  });

  // @lat: [[tests/graph-store#Derived edge ids with ordinals]]
  // @tg: verifies:: [[openspec:graph-model#Derived edge IDs#Duplicate edges]]
  it('gives duplicate edges ids that differ only in the ordinal', () => {
    const { graph, put } = vault();
    put({ path: 'Bob.md', text: '' });
    put({ path: 'Alice.md', text: 'knows:: [[Bob]]\nknows:: [[Bob]]' });
    expect(graph.outEdges('Alice.md').map((e) => e.id).sort()).toEqual([
      'Alice.md#knows#Bob.md#0',
      'Alice.md#knows#Bob.md#1',
    ]);
  });

  // @lat: [[tests/graph-store#Pinned edge id]]
  // @tg: verifies:: [[openspec:graph-model#Derived edge IDs#Pinned ID]]
  it('uses a pinned id when present and reports duplicate pinned ids', () => {
    const { graph, put } = vault();
    put({ path: 'Alice.md', text: 'knows:: [[Bob]] {id: "met-2020"}\nlikes:: [[Bob]] {id: "met-2020"}' });
    expect(graph.edge('met-2020')).toMatchObject({ type: 'knows', source: 'Alice.md' });
    expect(graph.size.edges).toBe(1);
    expect(graph.diagnostics()[0]!.message).toMatch(/Duplicate edge id 'met-2020'/);
  });

  // @lat: [[tests/graph-store#Incremental edit]]
  // @tg: verifies:: [[openspec:graph-model#Incremental updates#Note edited]]
  it('replaces only the edited note edges', () => {
    const { graph, put } = vault();
    put({ path: 'Bob.md', text: 'knows:: [[Carol]]' });
    put({ path: 'Alice.md', text: 'knows:: [[Bob]]' });
    const bobEdge = graph.outEdges('Bob.md')[0];
    put({ path: 'Alice.md', text: 'likes:: [[Bob]]' });
    expect(graph.outEdges('Alice.md').map((e) => e.type)).toEqual(['likes']);
    expect(graph.outEdges('Bob.md')[0]).toBe(bobEdge);
  });

  // @lat: [[tests/graph-store#Deleted target becomes stub]]
  // @tg: verifies:: [[openspec:graph-model#Incremental updates#Note deleted]]
  it('turns edges to a deleted note into edges to a stub', () => {
    const { graph, put, del } = vault();
    put({ path: 'Bob.md', text: '' });
    put({ path: 'Alice.md', text: 'knows:: [[Bob]]' });
    del('Bob.md');
    expect(graph.node('Bob.md')).toBeUndefined();
    expect(graph.node('Bob')).toMatchObject({ stub: true });
    expect(graph.outEdges('Alice.md')[0]!.target).toBe('Bob');
  });

  // @lat: [[tests/graph-store#Stubs released when unreferenced]]
  it('removes stubs when no edge references them and handles rename', () => {
    const { graph, put, del, existing } = vault();
    put({ path: 'Alice.md', text: 'knows:: [[Ghost]]\nlikes:: [[Ghost]]' });
    put({ path: 'Alice.md', text: 'likes:: [[Ghost]]' });
    expect(graph.node('Ghost')).toBeDefined();
    put({ path: 'Alice.md', text: '' });
    expect(graph.node('Ghost')).toBeUndefined();

    put({ path: 'Bob.md', text: '' });
    put({ path: 'Carol.md', text: 'knows:: [[Bob]]' });
    existing.delete('Bob.md');
    existing.add('Robert.md');
    graph.renameNote('Bob.md', { path: 'Robert.md', text: '' });
    expect(graph.node('Robert.md')).toBeDefined();
    // Carol still links to "Bob", which no longer exists until the host rewrites the link.
    expect(graph.outEdges('Carol.md')[0]!.target).toBe('Bob');
    del('Carol.md');
    expect(graph.node('Bob')).toBeUndefined();
  });
});
