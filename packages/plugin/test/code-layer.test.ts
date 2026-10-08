import { BuiltinEngine, LatIndex, buildLatGraph } from '@obsigraph/core';
import { expect, it } from 'vitest';
import { parseBlock } from '../src/query/block';
import { planRender } from '../src/query/plan';

// Built from parts so the real lat.md scanner does not read these fixtures as annotations.
const TG = '@' + 'tg:';

function world(symbols: number) {
  const body = Array.from({ length: symbols }, (_, i) => `export function fn${i}() {}\n`).join('');
  const src = `// ${TG} implements:: [[auth#Login]]\nexport function login() {}\n${body}`;
  const index = new LatIndex([
    { path: 'lat.md/lat.md', text: '# Lat\n\nIndex.\n' },
    { path: 'lat.md/auth.md', text: '# Auth\n\nHow login works.\n\n## Login\n\nChecks credentials.\n' },
  ]);
  const { graph } = buildLatGraph(index, { code: { mode: 'all', files: [{ path: 'src/auth.ts', text: src }] } });
  const run = (header: string, max = 500) => {
    const b = parseBlock(`${header}MATCH (a)-[r]->(b) RETURN a, r, b`);
    expect(b.errors).toEqual([]);
    return planRender(new BuiltinEngine(graph).run(b.query), b.options, max, (id) => graph.node(id));
  };
  return { run };
}

// @lat: [[tests/code-layer#Visible on demand#Hidden by header]]
it('code: hide removes code nodes and their edges from a block graph', () => {
  const { run } = world(2);
  const shown = run('');
  expect(shown.kind).toBe('graph');
  if (shown.kind !== 'graph') return;
  expect(shown.elements.nodes.some((n) => n.labels.includes('CodeSymbol'))).toBe(true);
  const hidden = run('code: hide\n');
  expect(hidden.kind).toBe('graph');
  if (hidden.kind !== 'graph') return;
  expect(hidden.elements.nodes.every((n) => !n.labels.some((l) => l.startsWith('Code')))).toBe(true);
  expect(hidden.elements.edges.every((e) => !e.source.startsWith('src/') && !e.target.startsWith('src/'))).toBe(true);
  expect(parseBlock('code: maybe\nMATCH (n) RETURN n').errors[0]!.message).toMatch(/Invalid code 'maybe'/);
});

// @lat: [[tests/code-layer#Visible on demand#Over the cap]]
// @tg: verifies:: [[openspec:code-layer#Visible on demand#Over the cap]]
it('falls back to a table with a notice when all-mode code exceeds the element cap', () => {
  const { run } = world(40);
  const plan = run('', 30);
  expect(plan.kind).toBe('table');
  if (plan.kind === 'table') expect(plan.notice).toMatch(/above the limit of 30/);
});
