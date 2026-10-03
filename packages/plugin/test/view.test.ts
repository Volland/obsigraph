import { Graph } from '@obsigraph/core';
import { describe, expect, it } from 'vitest';
import { toElements } from '../src/render/elements';
import { makeStyler } from '../src/render/styler';
import { edgeDetails, mergeElements, neighborhood, nodeDetails } from '../src/view/view-state';
import { BuiltinEngine } from '@obsigraph/core';

function fixture() {
  const notes: Record<string, [string, Record<string, unknown>]> = {
    'Alice.md': ['knows:: [[Bob]] {since: 2020}\n## Trust\n-distrusts:: [[Eve]]', { type: 'Person', age: 31 }],
    'Bob.md': ['knows:: [[Carol]]', { type: ['Person', 'Employee'] }],
    'Carol.md': ['likes:: [[Ghost]]', { type: 'Person' }],
    'Eve.md': ['', { type: 'Person' }],
  };
  const graph = new Graph((l) => (`${l}.md` in notes ? `${l}.md` : null));
  for (const [path, [text, frontmatter]] of Object.entries(notes)) graph.upsertNote({ path, text, frontmatter });
  return graph;
}

const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();

describe('graph view', () => {
  // @lat: [[tests/graph-view#Neighborhood of active note]]
  it('shows a node with its incident edges and direct neighbors in both directions', () => {
    const g = neighborhood(fixture(), 'Bob.md');
    expect(ids(g.nodes)).toEqual(['Alice.md', 'Bob.md', 'Carol.md']);
    expect(ids(g.edges)).toEqual(['Alice.md#knows#Bob.md#0', 'Bob.md#knows#Carol.md#0']);
    expect(neighborhood(fixture(), 'Missing.md')).toEqual({ nodes: [], edges: [] });
  });

  // @lat: [[tests/graph-view#Expansion keeps existing elements]]
  it('merges an expanded neighborhood without dropping existing elements', () => {
    const graph = fixture();
    const base = neighborhood(graph, 'Alice.md');
    const merged = mergeElements(base, neighborhood(graph, 'Bob.md'));
    expect(ids(merged.nodes)).toEqual(['Alice.md', 'Bob.md', 'Carol.md', 'Eve.md']);
    expect(merged.edges).toHaveLength(3);
    for (const n of base.nodes) expect(merged.nodes).toContain(n);
  });

  // @lat: [[tests/graph-view#Edge selection details]]
  it('describes a selected edge with type, sign, id, heading and properties', () => {
    const graph = fixture();
    const d = edgeDetails(graph.edge('Alice.md#knows#Bob.md#0')!, graph);
    expect(d.title).toBe('Alice knows → Bob');
    expect(d.rows).toEqual(
      expect.arrayContaining([
        ['type', 'knows'],
        ['sign', '+1'],
        ['id', 'Alice.md#knows#Bob.md#0'],
        ['since', '2020'],
      ]),
    );
    const neg = edgeDetails(graph.edge('Alice.md#distrusts#Eve.md#0')!, graph);
    expect(neg.title).toBe('Alice −distrusts → Eve');
    expect(neg.rows).toEqual(expect.arrayContaining([['sign', '-1 (negative)'], ['heading', 'Trust']]));
  });

  // @lat: [[tests/graph-view#Node selection details]]
  it('describes a selected node with labels and properties', () => {
    const d = nodeDetails(fixture().node('Bob.md')!);
    expect(d.title).toBe('Bob');
    expect(d.rows).toEqual(expect.arrayContaining([['labels', 'Person, Employee'], ['stub', 'false'], ['path', 'Bob.md']]));
  });

  // @lat: [[tests/graph-view#Same element same style]]
  it('produces identical element data and classes for a node in a block and in the view', () => {
    const graph = fixture();
    const fromBlock = toElements(new BuiltinEngine(graph).run('MATCH (n {title: "Bob"}) RETURN n'), (id) => graph.node(id));
    const fromView = neighborhood(graph, 'Bob.md');
    const a = fromBlock.nodes[0]!;
    const b = fromView.nodes.find((n) => n.id === 'Bob.md')!;
    expect(a).toEqual(b);
    const styler = makeStyler([]);
    expect(styler.node(a)).toEqual(styler.node(b));
  });

  // @lat: [[tests/graph-view#Stubs visible in neighborhood]]
  it('includes stub neighbors so unresolved links stay visible', () => {
    const g = neighborhood(fixture(), 'Carol.md');
    expect(g.nodes.find((n) => n.id === 'Ghost')).toMatchObject({ stub: true, path: null });
  });
});
