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
  return { graph, put, del };
}

const edgeNote = (path: string, fm: Record<string, unknown>, text = ''): NoteInput => ({ path, text, frontmatter: { type: 'edge', ...fm } });

describe('edge notes', () => {
  // @lat: [[tests/edge-notes#Edge note becomes an edge]]
  // @tg: verifies:: [[openspec:graph-model#Edge notes#Edge note becomes an edge]]
  it('turns a type: edge note into one edge and no node', () => {
    const { graph, put } = vault();
    put({ path: 'Alice.md', text: '' });
    put({ path: 'Bob.md', text: '' });
    put(edgeNote('Alice knows Bob.md', { from: '[[Alice]]', to: [['Bob']], edgeType: 'knows', since: 2020 }, 'likes:: [[Alice]]'));
    expect(graph.node('Alice knows Bob.md')).toBeUndefined();
    expect([...graph.edges()]).toEqual([
      { id: 'Alice knows Bob.md', type: 'knows', sign: 1, source: 'Alice.md', target: 'Bob.md', props: { since: 2020 }, heading: null, line: 0, file: 'Alice knows Bob.md' },
    ]);
    expect(graph.outEdges('Alice.md').map((e) => e.id)).toEqual(['Alice knows Bob.md']);
    expect(graph.inEdges('Bob.md').map((e) => e.id)).toEqual(['Alice knows Bob.md']);
    expect(graph.declaredEdges('Alice knows Bob.md')).toHaveLength(1);
  });

  // @lat: [[tests/edge-notes#Pinned id and sign]]
  // @tg: verifies:: [[openspec:graph-model#Edge notes#Negative edge note]]
  it('takes the sign from the edgeType prefix and pins the id', () => {
    const { graph, put } = vault();
    put({ path: 'Alice.md', text: '' });
    put(edgeNote('e.md', { from: 'Alice', to: '[Eve](Eve.md)', edgeType: '-distrusts', id: 'grudge' }));
    const [e] = [...graph.edges()];
    expect(e).toMatchObject({ id: 'grudge', type: 'distrusts', sign: -1, source: 'Alice.md', target: 'Eve', props: { id: 'grudge' } });
  });

  // @lat: [[tests/edge-notes#Endpoints follow notes]]
  // @tg: verifies:: [[openspec:graph-model#Edge notes#Missing endpoint becomes a stub]]
  it('points missing endpoints at stubs and re-points them when notes appear or vanish', () => {
    const { graph, put, del } = vault();
    put(edgeNote('e.md', { from: '[[Alice]]', to: '[[Nobody]]', edgeType: 'knows' }));
    expect(graph.node('Alice')).toMatchObject({ stub: true });
    expect(graph.node('Nobody')).toMatchObject({ stub: true });
    put({ path: 'Nobody.md', text: '' });
    put({ path: 'Alice.md', text: '' });
    expect(graph.edge('e.md')).toMatchObject({ source: 'Alice.md', target: 'Nobody.md' });
    expect(graph.node('Alice')).toBeUndefined();
    del('Alice.md');
    expect(graph.edge('e.md')!.source).toBe('Alice');
    del('e.md');
    expect([...graph.nodes()].map((n) => n.id)).toEqual(['Nobody.md']);
    expect(graph.size.edges).toBe(0);
  });

  // @lat: [[tests/edge-notes#Incomplete edge note]]
  // @tg: verifies:: [[openspec:graph-model#Edge notes#Incomplete edge note]]
  it('reports a missing field and contributes nothing', () => {
    const { graph, put } = vault();
    put(edgeNote('e.md', { from: '[[Alice]]', to: '[[Bob]]' }));
    expect(graph.size).toEqual({ nodes: 0, edges: 0 });
    expect(graph.diagnostics()).toEqual([{ path: 'e.md', line: 0, column: 0, message: 'Edge note is missing edgeType; it declares no edge', code: 'edge-note' }]);
  });

  // @lat: [[tests/edge-notes#Links to edge notes refused]]
  // @tg: verifies:: [[openspec:graph-model#Links to edge notes#Inline edge to an edge note]]
  it('refuses links to an edge note and accepts them again when it becomes a note', () => {
    const { graph, put } = vault();
    put({ path: 'Alice.md', text: '' });
    put({ path: 'Bob.md', text: '' });
    put({ path: 'Carol.md', text: 'x\nabout:: [[Alice knows Bob]]' });
    expect(graph.node('Alice knows Bob')).toMatchObject({ stub: true });
    put(edgeNote('Alice knows Bob.md', { from: '[[Alice]]', to: '[[Bob]]', edgeType: 'knows' }));
    expect(graph.outEdges('Carol.md')).toEqual([]);
    expect(graph.node('Alice knows Bob')).toBeUndefined();
    expect(graph.diagnostics()).toContainEqual({ path: 'Carol.md', line: 1, column: 0, message: "'Alice knows Bob' is an edge note, not a node; no edge is created", code: 'edge-note' });
    put({ path: 'Alice knows Bob.md', text: '' });
    expect(graph.outEdges('Carol.md').map((e) => e.target)).toEqual(['Alice knows Bob.md']);
    expect(graph.diagnostics()).toEqual([]);
    put(edgeNote('Alice knows Bob.md', { from: '[[Alice]]', to: '[[Bob]]', edgeType: 'knows' }));
    expect(graph.outEdges('Carol.md')).toEqual([]);
    expect(graph.edge('Alice knows Bob.md')).toBeDefined();
  });

  it('still declares only its one edge when frontmatter links are edges too', () => {
    const existing = new Set(['Alice.md', 'Bob.md', 'Paper.md']);
    const graph = new Graph((l) => (existing.has(`${l}.md`) ? `${l}.md` : null), undefined, { frontmatterEdges: true });
    for (const p of existing) graph.upsertNote({ path: p, text: '' });
    graph.upsertNote(edgeNote('e.md', { from: '[[Alice]]', to: '[[Bob]]', edgeType: 'knows', source: '[[Paper]]' }));
    expect([...graph.edges()].map((e) => [e.id, e.type, e.source, e.target])).toEqual([['e.md', 'knows', 'Alice.md', 'Bob.md']]);
    expect(graph.edge('e.md')!.props).toEqual({ source: '[[Paper]]' });
  });
});
