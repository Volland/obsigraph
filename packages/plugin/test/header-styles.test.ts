import { describe, expect, it } from 'vitest';
import { parseBlock, parseStylePairs } from '../src/query/block';
import { sameElementSet } from '../src/render/elements';

describe('block header styles', () => {
  // @lat: [[tests/visualization-config#Header style scoped to block]]
  // @tg: verifies:: [[openspec:visualization-config#Block header style entries#Header style scoped to one block]]
  it('parses node.<Type> and edge.<type> entries scoped to the block', () => {
    const b = parseBlock('node.Project: shape=diamond, color=rgb(1, 2, 3)\nedge.knows: color=orange; line=dotted\n\nMATCH (n) RETURN n');
    expect(b.errors).toEqual([]);
    expect(b.styles).toEqual({
      nodes: { Project: { shape: 'diamond', color: 'rgb(1, 2, 3)' } },
      edges: { knows: { color: 'orange', line: 'dotted' } },
    });
    expect(b.query).toBe('MATCH (n) RETURN n');
    expect(parseBlock('MATCH (n) RETURN n').styles).toEqual({ nodes: {}, edges: {} });
    expect(parseStylePairs('shape diamond')).toMatch(/Expected attribute=value/);
    expect(parseBlock('node.Project: oops\nMATCH (n) RETURN n').errors[0]).toMatchObject({ line: 0 });
  });

  // @lat: [[tests/visualization-config#Restyle keeps layout]]
  it('detects an unchanged element set so live updates restyle in place', () => {
    const shown = new Set(['a', 'b', 'e']);
    const n = (id: string) => ({ id, label: id, labels: [], stub: false, path: id, props: {} });
    const e = { id: 'e', source: 'a', target: 'b', type: 't', sign: 1 as const };
    expect(sameElementSet(shown, { nodes: [n('b'), n('a')], edges: [e] })).toBe(true);
    expect(sameElementSet(shown, { nodes: [n('a')], edges: [e] })).toBe(false);
    expect(sameElementSet(shown, { nodes: [n('a'), n('b'), n('c')], edges: [e] })).toBe(false);
  });
});
