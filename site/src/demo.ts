// Live demo: the plugin's real core engine, schema styling and renderer,
// running in the browser over an editable sample vault.
import cytoscape from 'cytoscape';
import { parse as parseYaml } from 'yaml';
import {
  BuiltinEngine,
  CypherError,
  Graph,
  NodeRef,
  PathRef,
  pathResolver,
  RelRef,
  schemasFromGraph,
  splitFrontmatter,
  styleSource,
  styleSourcesFromSchemas,
  type QueryResult,
  type Value,
} from '@obsigraph/core';
import { parseBlock } from '../../packages/plugin/src/query/block';
import { planRender } from '../../packages/plugin/src/query/plan';
import { buildStylesheet } from '../../packages/plugin/src/render/styles';
import { makeStyler } from '../../packages/plugin/src/render/styler';
import type { GraphElements } from '../../packages/plugin/src/render/elements';
import { EXAMPLES, VAULT } from './sample';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Notes are separated by `=== path.md ===` lines in the editor. */
function parseVault(src: string): { path: string; text: string }[] {
  const notes: { path: string; text: string }[] = [];
  let cur: { path: string; lines: string[] } | null = null;
  for (const line of src.split('\n')) {
    const m = /^===\s*(.+?\.md)\s*===\s*$/.exec(line);
    if (m) {
      if (cur) notes.push({ path: cur.path, text: cur.lines.join('\n').trim() });
      cur = { path: m[1]!, lines: [] };
    } else cur?.lines.push(line);
  }
  if (cur) notes.push({ path: cur.path, text: cur.lines.join('\n').trim() });
  return notes;
}

function buildGraph(src: string): Graph {
  const notes = parseVault(src);
  const graph = new Graph(pathResolver(() => notes.map((n) => n.path)));
  for (const n of notes) {
    const { yaml } = splitFrontmatter(n.text);
    let fm: Record<string, unknown> | null = null;
    try {
      fm = yaml ? (parseYaml(yaml) as Record<string, unknown>) : null;
    } catch {
      fm = null;
    }
    graph.upsertNote({ path: n.path, text: n.text, frontmatter: fm });
  }
  return graph;
}

const theme = () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  return dark ? { text: '#e8e6f3', muted: '#8d88a8', background: '#14121f' } : { text: '#1f1b2e', muted: '#8a86a0', background: '#ffffff' };
};

let cy: cytoscape.Core | null = null;

function drawGraph(host: HTMLElement, g: GraphElements, styler: ReturnType<typeof makeStyler>) {
  cy?.destroy();
  host.replaceChildren();
  cy = cytoscape({
    container: host,
    wheelSensitivity: 0.3,
    style: [
      ...buildStylesheet(theme()),
      // Slightly larger labels than inside Obsidian for the demo canvas.
      { selector: 'node', style: { 'font-size': 13, width: 26, height: 26 } },
      { selector: 'edge', style: { 'font-size': 10 } },
    ] as unknown as cytoscape.StylesheetJson,
    elements: [
      ...g.nodes.map((n) => ({ group: 'nodes' as const, data: { id: n.id, labels: n.labels, ...styler.node(n) }, classes: n.stub ? ['stub'] : [] })),
      ...g.edges.map((e) => ({
        group: 'edges' as const,
        data: { id: e.id, source: e.source, target: e.target, type: e.sign < 0 ? `−${e.type}` : e.type, ...styler.edge(e) },
        classes: e.sign < 0 ? ['negative'] : [],
      })),
    ],
  });
  // Seeded randomness makes the force layout stable between runs and screenshots.
  let seed = 7;
  const random = Math.random;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  try {
    cy.layout({
      name: 'cose',
      animate: false,
      randomize: true,
      padding: 36,
      nodeRepulsion: () => 400000,
      idealEdgeLength: () => 130,
      edgeElasticity: () => 100,
      nodeOverlap: 40,
      componentSpacing: 80,
      gravity: 40,
      numIter: 2500,
    } as cytoscape.LayoutOptions).run();
  } finally {
    Math.random = random;
  }
  cy.fit(undefined, 40);
  // Never zoom in past 1:1 so small results keep normal-sized labels.
  if (cy.zoom() > 1) {
    cy.zoom(1);
    cy.center();
  }
}

function cell(v: Value): string {
  if (v === null) return '';
  if (v instanceof NodeRef) return String(v.node.props.title ?? v.id);
  if (v instanceof RelRef) return `${v.edge.sign < 0 ? '−' : ''}${v.edge.type}`;
  if (v instanceof PathRef) return v.nodes.map((n, i) => (i ? `-${cell(v.rels[i - 1]!)}-> ${cell(n)}` : cell(n))).join(' ');
  if (Array.isArray(v)) return v.map(cell).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function drawTable(host: HTMLElement, r: QueryResult, indexes: number[]) {
  cy?.destroy();
  cy = null;
  const table = document.createElement('table');
  table.className = 'result-table';
  const head = table.createTHead().insertRow();
  for (const i of indexes) head.insertCell().outerHTML = `<th>${escapeHtml(r.columns[i]!.name)}</th>`;
  const body = table.createTBody();
  for (const row of r.rows) {
    const tr = body.insertRow();
    for (const i of indexes) tr.insertCell().textContent = cell(row[i] ?? null);
  }
  if (r.rows.length === 0) body.insertRow().insertCell().textContent = 'No results';
  host.replaceChildren(table);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function run() {
  const out = $('result');
  const msg = $('message');
  msg.textContent = '';
  msg.className = 'message';
  const graph = buildGraph($<HTMLTextAreaElement>('vault').value);
  const block = parseBlock($<HTMLTextAreaElement>('query').value);
  $('stats').textContent = `${[...graph.nodes()].filter((n) => !n.stub).length} notes · ${graph.size.edges} edges`;
  if (block.errors.length) {
    msg.textContent = block.errors.map((e) => `Line ${e.line + 1}: ${e.message}`).join('\n');
    msg.className = 'message error';
    return;
  }
  let result: QueryResult;
  try {
    result = new BuiltinEngine(graph).run(block.query);
  } catch (e) {
    if (!(e instanceof CypherError)) throw e;
    msg.textContent = `${e.kind}: ${e.message}${e.line ? ` (line ${e.line + block.queryLine}, column ${e.column})` : ''}`;
    msg.className = 'message error';
    out.replaceChildren();
    return;
  }
  const plan = planRender(result, block.options, 600, (id) => graph.node(id));
  if (plan.kind === 'error') {
    msg.textContent = plan.messages.join('\n');
    msg.className = 'message error';
    return;
  }
  const notices = [...(plan.kind === 'table' && plan.notice ? [plan.notice] : []), ...plan.notices];
  if (notices.length) msg.textContent = notices.join('\n');
  if (plan.kind === 'graph') {
    const schemas = schemasFromGraph(graph, 'Types/');
    const header = styleSource('block header', null, block.styles.nodes, block.styles.edges).source;
    drawGraph(out, plan.elements, makeStyler([header, ...styleSourcesFromSchemas(schemas.schemas).sources]));
  } else {
    drawTable(out, result, plan.indexes);
  }
}

function init() {
  $<HTMLTextAreaElement>('vault').value = VAULT;
  const picker = $<HTMLSelectElement>('examples');
  for (const [i, ex] of EXAMPLES.entries()) picker.add(new Option(ex.title, String(i)));
  const params = new URLSearchParams(location.search);
  const pick = (i: number) => {
    picker.value = String(i);
    $<HTMLTextAreaElement>('query').value = EXAMPLES[i]!.query;
    run();
  };
  picker.addEventListener('change', () => pick(Number(picker.value)));
  $('run').addEventListener('click', run);
  for (const id of ['query', 'vault']) {
    $(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        run();
      }
    });
  }
  pick(Math.min(Number(params.get('example') ?? 0), EXAMPLES.length - 1));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', run);
  window.addEventListener('obsigraph-theme', run);
}

init();
