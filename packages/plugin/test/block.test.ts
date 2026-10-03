import { BuiltinEngine, Graph } from '@obsigraph/core';
import { describe, expect, it } from 'vitest';
import { chooseView, parseBlock } from '../src/query/block';
import { planRender } from '../src/query/plan';
import { buildStylesheet, colorFor, nodeClasses, parseTypeStyles } from '../src/render/styles';

function fixture() {
  const notes: Record<string, string> = {
    'Alice.md': 'knows:: [[Bob]] {since: 2020}\n-distrusts:: [[Eve]]',
    'Bob.md': 'knows:: [[Carol]]',
    'Carol.md': '',
    'Eve.md': '',
  };
  const graph = new Graph((l) => (`${l}.md` in notes ? `${l}.md` : null));
  for (const [path, text] of Object.entries(notes)) graph.upsertNote({ path, text, frontmatter: { type: 'Person' } });
  const engine = new BuiltinEngine(graph);
  const plan = (source: string, max = 500) => {
    const b = parseBlock(source);
    expect(b.errors).toEqual([]);
    return planRender(engine.run(b.query), b.options, max, (id) => graph.node(id));
  };
  return { graph, engine, plan };
}

const THEME = { text: '#000', muted: '#999', background: '#fff' };

describe('graph-query block', () => {
  // @lat: [[tests/graph-query-block#Header and query split]]
  it('splits the header from the query and maps the query start line', () => {
    const b = parseBlock('view: table\ncolumns: a, b\nheight: 500px\n\nMATCH (a)-->(b)\nRETURN a, b');
    expect(b.options).toEqual({ view: 'table', columns: ['a', 'b'], height: 500 });
    expect(b.query).toBe('MATCH (a)-->(b)\nRETURN a, b');
    expect(b.queryLine).toBe(4);
    expect(b.errors).toEqual([]);
  });

  // @lat: [[tests/graph-query-block#Query without header]]
  it('uses defaults when there is no header', () => {
    const b = parseBlock('MATCH (n:Person) RETURN n');
    expect(b.options).toEqual({ view: 'auto', columns: null, height: 360 });
    expect(b.query).toBe('MATCH (n:Person) RETURN n');
    expect(b.queryLine).toBe(0);
  });

  // @lat: [[tests/graph-query-block#Header errors reported]]
  it('reports unknown options and invalid values with their line', () => {
    const b = parseBlock('view: pie\ncolour: red\nheight: 5\nMATCH (n) RETURN n');
    expect(b.errors.map((e) => e.line)).toEqual([0, 1, 2]);
    expect(b.errors[0]!.message).toMatch(/Invalid view 'pie'/);
    expect(b.errors[1]!.message).toMatch(/Unknown option 'colour'/);
  });

  // @lat: [[tests/graph-query-block#Graph for nodes and edges]]
  it('renders a graph when the result holds nodes or relationships, with edge endpoints added', () => {
    const { plan } = fixture();
    const p = plan('MATCH ()-[r]->() RETURN r');
    expect(p.kind).toBe('graph');
    if (p.kind !== 'graph') return;
    expect(p.elements.edges.map((e) => [e.type, e.sign]).sort()).toEqual([['distrusts', -1], ['knows', 1], ['knows', 1]]);
    expect(p.elements.nodes.map((n) => n.label).sort()).toEqual(['Alice', 'Bob', 'Carol', 'Eve']);
  });

  // @lat: [[tests/graph-query-block#Table for scalars]]
  it('renders a table when the result holds only scalars', () => {
    const { plan, engine } = fixture();
    expect(plan('MATCH (a)-[r]->(b) RETURN a.title, r.since').kind).toBe('table');
    expect(chooseView(engine.run('MATCH (a) RETURN a'), 'auto')).toBe('graph');
  });

  // @lat: [[tests/graph-query-block#View and columns override]]
  it('honors view: table and selects and orders columns', () => {
    const { plan } = fixture();
    const p = plan('view: table\ncolumns: b, a\n\nMATCH (a)-[r]->(b) RETURN a, r, b');
    expect(p).toEqual({ kind: 'table', indexes: [2, 0], notice: null });
    const bad = plan('columns: nope\n\nMATCH (a) RETURN a.title AS t');
    expect(bad.kind).toBe('error');
    if (bad.kind === 'error') expect(bad.messages[0]).toMatch(/Unknown column 'nope' \(available: t\)/);
  });

  // @lat: [[tests/graph-query-block#Element cap falls back to table]]
  it('falls back to a table with a notice above the element cap', () => {
    const { plan } = fixture();
    const p = plan('MATCH (a)-[r]->(b) RETURN a, r, b', 3);
    expect(p.kind).toBe('table');
    if (p.kind === 'table') expect(p.notice).toMatch(/7 elements, above the limit of 3/);
  });

  // @lat: [[tests/graph-query-block#Signed and typed styling]]
  it('styles negative edges distinctly and nodes per type, stubs last', () => {
    const rules = buildStylesheet({ Person: { color: '#123456', shape: 'diamond' } }, ['Person', 'Company'], THEME);
    expect(rules.find((r) => r.selector === 'edge')!.style.label).toBe('data(type)');
    expect(rules.find((r) => r.selector === 'edge.negative')!.style['line-style']).toBe('dashed');
    expect(rules.find((r) => r.selector === 'node.t-Person')!.style).toEqual({ 'background-color': '#123456', shape: 'diamond' });
    expect(rules.find((r) => r.selector === 'node.t-Company')!.style['background-color']).toBe(colorFor('Company'));
    expect(rules.at(-1)!.selector).toBe('node.stub');
    expect(nodeClasses(['Big Co'], true)).toEqual(['t-Big_Co', 'stub']);
  });

  // @lat: [[tests/graph-query-block#Type style settings validated]]
  it('validates type style settings', () => {
    expect(parseTypeStyles('{"Person": {"color": "red", "shape": "star"}}')).toEqual({ Person: { color: 'red', shape: 'star' } });
    expect(parseTypeStyles('{"Person": {"shape": "blob"}}')).toMatch(/shape for 'Person'/);
    expect(parseTypeStyles('[1]')).toMatch(/object keyed by type label/);
    expect(parseTypeStyles('{bad')).toMatch(/Invalid JSON/);
  });
});
