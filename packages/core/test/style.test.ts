import { describe, expect, it } from 'vitest';
import {
  colorFor,
  Graph,
  isCssColor,
  nodeLabelText,
  resolveEdgeStyle,
  resolveNodeStyle,
  schemasFromGraph,
  styleSource,
  styleSourcesFromSchemas,
  type StyleSource,
} from '../src/index.js';

function schemaSources(schemas: Record<string, Record<string, unknown>>, iconExists?: (n: string) => boolean) {
  const graph = new Graph(() => null);
  for (const [type, visualization] of Object.entries(schemas)) {
    graph.upsertNote({ path: `Types/${type}.md`, text: '', frontmatter: { schema: { visualization } } });
  }
  return styleSourcesFromSchemas(schemasFromGraph(graph, 'Types/').schemas, iconExists);
}

const settings = (nodes: Record<string, unknown>, edges: Record<string, unknown> = {}): StyleSource =>
  styleSource('settings', null, nodes, edges).source;
const block = (nodes: Record<string, unknown>, edges: Record<string, unknown> = {}): StyleSource =>
  styleSource('block header', null, nodes, edges).source;

describe('visualization config', () => {
  // @lat: [[tests/visualization-config#Block header beats schema note]]
  // @tg: verifies:: [[openspec:visualization-config#Precedence of style sources#Block header beats schema note]]
  it('lets a block header override the schema note only where it is used', () => {
    const schema = schemaSources({ Person: { color: 'blue' } }).sources;
    expect(resolveNodeStyle(['Person'], [block({ Person: { color: 'red' } }), ...schema]).color).toBe('red');
    expect(resolveNodeStyle(['Person'], schema).color).toBe('blue');
  });

  // @lat: [[tests/visualization-config#Schema note beats settings]]
  // @tg: verifies:: [[openspec:visualization-config#Precedence of style sources#Schema note beats settings]]
  it('ranks schema notes above plugin settings', () => {
    const s = resolveNodeStyle(['Person'], [...schemaSources({ Person: { color: 'blue' } }).sources, settings({ Person: { color: 'green' } })]);
    expect(s.color).toBe('blue');
    expect(s.origin.color).toBe('schema Types/Person.md');
  });

  // @lat: [[tests/visualization-config#Attributes fall through independently]]
  // @tg: verifies:: [[openspec:visualization-config#Precedence of style sources#Attributes fall through independently]]
  it('resolves each attribute independently', () => {
    const s = resolveNodeStyle(['Person'], [...schemaSources({ Person: { shape: 'diamond' } }).sources, settings({ Person: { color: 'green' } })]);
    expect([s.shape, s.color]).toEqual(['diamond', 'green']);
    expect(s.origin).toEqual({ shape: 'schema Types/Person.md', color: 'settings', icon: 'built-in default', label: 'built-in default' });
    const none = resolveNodeStyle(['Thing'], []);
    expect([none.color, none.shape, none.icon]).toEqual([colorFor('Thing'), 'ellipse', null]);
  });

  // @lat: [[tests/visualization-config#Schema visualization applied]]
  // @tg: verifies:: [[openspec:visualization-config#Schema visualization block#Declared visualization applied]]
  it('reads color, shape and icon from the schema visualization block', () => {
    const { sources, diagnostics } = schemaSources({ Person: { color: '#3b82f6', shape: 'ellipse', icon: 'user' } }, (n) => n === 'user');
    expect(diagnostics).toEqual([]);
    expect(resolveNodeStyle(['Person'], sources)).toMatchObject({ color: '#3b82f6', shape: 'ellipse', icon: 'user' });
  });

  // @lat: [[tests/visualization-config#Label property]]
  // @tg: verifies:: [[openspec:visualization-config#Schema visualization block#Label property]]
  it('labels nodes by the declared property, falling back to the title', () => {
    const s = resolveNodeStyle(['Person'], schemaSources({ Person: { label: 'name' } }).sources);
    expect(s.label).toBe('name');
    expect(nodeLabelText({ name: 'Alice' }, 'alice-note', s.label)).toBe('Alice');
    expect(nodeLabelText({}, 'alice-note', s.label)).toBe('alice-note');
  });

  // @lat: [[tests/visualization-config#Edge type color]]
  // @tg: verifies:: [[openspec:visualization-config#Edge type styling#Edge type color]]
  it('styles edge types from schema notes and settings', () => {
    const schema = schemaSources({ Person: { edges: { knows: { color: 'orange' } } } }).sources;
    expect(resolveEdgeStyle('knows', 1, [...schema, settings({}, { knows: { color: 'green', line: 'dotted' } })])).toMatchObject({
      color: 'orange',
      line: 'dotted',
      origin: { color: 'schema Types/Person.md', line: 'settings' },
    });
  });

  // @lat: [[tests/visualization-config#Negative sign default]]
  // @tg: verifies:: [[openspec:visualization-config#Edge type styling#Sign rendering default]]
  it('renders negative edges dashed red unless a source sets the attribute', () => {
    expect(resolveEdgeStyle('distrusts', -1, [])).toMatchObject({ color: '#d94848', line: 'dashed' });
    expect(resolveEdgeStyle('distrusts', 1, [])).toMatchObject({ color: '#8a8a8a', line: 'solid' });
    expect(resolveEdgeStyle('distrusts', -1, [settings({}, { distrusts: { line: 'dotted' } })])).toMatchObject({ color: '#d94848', line: 'dotted' });
  });

  // @lat: [[tests/visualization-config#Bad value falls through]]
  // @tg: verifies:: [[openspec:visualization-config#Invalid style values are ignored visibly#Bad color in schema note]]
  it('ignores an invalid value, falls through and reports the source and attribute', () => {
    const schema = schemaSources({ Person: { color: 'not-a-color', icon: 'nope' } }, () => false);
    const s = resolveNodeStyle(['Person'], [...schema.sources, settings({ Person: { color: 'green' } })]);
    expect(s.color).toBe('green');
    expect(schema.diagnostics.map((d) => [d.path, d.message])).toEqual([
      ['Types/Person.md', "Ignored color 'not-a-color' for type Person in schema Types/Person.md: expected a CSS color"],
      ['Types/Person.md', "Ignored icon 'nope' for type Person in schema Types/Person.md: expected a known icon name"],
    ]);
    expect(['#abc', 'rgb(1, 2, 3)', 'hsla(10, 50%, 50%, 0.5)', 'RebeccaPurple'].every(isCssColor)).toBe(true);
    expect(['#abcde', 'rgb(1,2)', 'bluish', ''].some(isCssColor)).toBe(false);
  });

  // @lat: [[tests/visualization-config#Second label supplies shape]]
  // @tg: verifies:: [[openspec:visualization-config#Multi-label nodes#Second label supplies shape]]
  it('takes each attribute from the first label that supplies it', () => {
    const sources = schemaSources({ Person: { color: 'blue' }, Employee: { shape: 'hexagon', color: 'red' } }).sources;
    expect(resolveNodeStyle(['Person', 'Employee'], sources)).toMatchObject({ color: 'blue', shape: 'hexagon' });
  });

  // @lat: [[tests/visualization-config#Schema edit restyles]]
  // @tg: verifies:: [[openspec:visualization-config#Live style updates#Color edit refreshes open graphs]]
  it('picks up a color edit in a schema note on the next resolution', () => {
    const graph = new Graph(() => null);
    const put = (color: string) => graph.upsertNote({ path: 'Types/Person.md', text: '', frontmatter: { schema: { visualization: { color } } } });
    put('blue');
    const resolve = () => resolveNodeStyle(['Person'], styleSourcesFromSchemas(schemasFromGraph(graph, 'Types/').schemas).sources).color;
    expect(resolve()).toBe('blue');
    put('purple');
    expect(resolve()).toBe('purple');
  });
});
