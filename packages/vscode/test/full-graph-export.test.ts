import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildHtml, exportFileName } from '../src/export';
import { GraphSession } from '../src/graph-session';
import { buildGraphPdf, sizeSummary, type Scene } from '../src/pdf';
import { WorkspaceIndex } from '../src/workspace-index';
import { workspace } from './index.test';

const FILES: Record<string, string> = {
  'notes/Alice.md': 'knows:: [[Bob]] {since: 2020}\n-distrusts:: [[Eve]]\n',
  'notes/Carol.md': 'knows:: [[Bob]]\n',
  'notes/Bob.md': '',
  'notes/Eve.md': '',
  'notes/Lonely.md': '',
};

async function load() {
  const dir = workspace(FILES);
  const idx = new WorkspaceIndex({ workspace: dir, roots: ['.'], ignore: ['node_modules'] });
  await idx.load();
  return { dir, idx };
}

const SCENE: Scene = {
  nodes: [
    { id: 'a', x: 0, y: 0, w: 24, h: 24, shape: 'ellipse', color: '#4e79a7', label: 'Alice (CEO)', stub: false },
    { id: 'b', x: 120, y: 40, w: 24, h: 24, shape: 'diamond', color: '#e15759', label: 'Zoë \\ Bob', stub: false },
    { id: 'c', x: 60, y: 120, w: 24, h: 24, shape: 'rectangle', color: '#59a14f', label: 'Ghost', stub: true },
  ],
  edges: [
    { source: 'a', target: 'b', color: '#4e79a7', line: 'solid', negative: false, label: 'knows' },
    { source: 'b', target: 'a', color: '#e15759', line: 'dashed', negative: true, label: '−blocks' },
    { source: 'a', target: 'a', color: '#888888', line: 'dotted', negative: false, label: 'self' },
  ],
};
const META = { scope: 'project' as const, omitted: 0, limit: 2000, date: new Date('2026-10-14T12:00:00Z') };

// @tg: verifies:: [[tests/vscode-extension#Whole project graph#Full graph and toggle]] {since: "2026-10-14", level: unit}
// @lat: [[tests/vscode-extension#Whole project graph#Full graph and toggle]]
// @tg: verifies:: [[openspec:vscode-extension#Whole project graph#Open the full graph]]
// @tg: verifies:: [[openspec:vscode-extension#Whole project graph#Toggle scope]]
it('draws every node and edge in the project scope, ignoring the active file, and toggles back', async () => {
  const { idx } = await load();
  const session = new GraphSession(() => idx.graph);
  expect(session.scope).toBe('file');
  const small = session.view('notes/Carol.md');
  expect(small.elements.nodes.map((n) => n.id).sort()).toEqual(['notes/Bob.md', 'notes/Carol.md']);
  session.setScope('project');
  const all = session.view('notes/Carol.md');
  expect(all.scope).toBe('project');
  expect(all.elements.nodes.map((n) => n.id).sort()).toEqual(['notes/Alice.md', 'notes/Bob.md', 'notes/Carol.md', 'notes/Eve.md', 'notes/Lonely.md']);
  expect(all.elements.edges).toHaveLength(3);
  expect(all.omitted).toBe(0);
  expect(session.view(null).elements.nodes).toHaveLength(5);
  session.setScope('file');
  expect(session.view('notes/Carol.md').elements.nodes.map((n) => n.id).sort()).toEqual(['notes/Bob.md', 'notes/Carol.md']);
});

// @tg: verifies:: [[tests/vscode-extension#Whole project graph#Limit keeps the most connected]] {since: "2026-10-14", level: unit}
// @lat: [[tests/vscode-extension#Whole project graph#Limit keeps the most connected]]
// @tg: verifies:: [[openspec:vscode-extension#Whole project graph#Large graph is capped]]
it('keeps the most connected nodes up to the limit, only edges among them, and counts what was left out', async () => {
  const { idx } = await load();
  const session = new GraphSession(() => idx.graph, () => 3);
  session.setScope('project');
  const v = session.view(null);
  expect(v.elements.nodes.map((n) => n.id).sort()).toEqual(['notes/Alice.md', 'notes/Bob.md', 'notes/Carol.md']);
  expect(v.elements.edges.every((e) => ['notes/Alice.md', 'notes/Bob.md', 'notes/Carol.md'].includes(e.source) && ['notes/Alice.md', 'notes/Bob.md', 'notes/Carol.md'].includes(e.target))).toBe(true);
  expect(v.elements.edges).toHaveLength(2);
  expect([v.total, v.omitted, v.limit]).toEqual([5, 2, 3]);
  expect(session.view(null).elements.nodes.map((n) => n.id)).toEqual(v.elements.nodes.map((n) => n.id));
});

// @tg: verifies:: [[tests/vscode-extension#Whole project graph#Full graph stays current]] {since: "2026-10-14", level: unit}
// @lat: [[tests/vscode-extension#Whole project graph#Full graph stays current]]
// @tg: verifies:: [[openspec:vscode-extension#Whole project graph#Full graph stays current]]
it('shows a new edge in the project scope after the file is saved', async () => {
  const { dir, idx } = await load();
  const session = new GraphSession(() => idx.graph);
  session.setScope('project');
  expect(session.view(null).elements.edges).toHaveLength(3);
  writeFileSync(join(dir, 'notes/Lonely.md'), 'knows:: [[Eve]]\n');
  await idx.update('notes/Lonely.md');
  expect(session.view(null).elements.edges).toHaveLength(4);
});

// @tg: verifies:: [[tests/vscode-extension#Graph export#Standalone HTML]] {since: "2026-10-14", level: unit}
// @lat: [[tests/vscode-extension#Graph export#Standalone HTML]]
// @tg: verifies:: [[openspec:graph-export#Export the graph as standalone HTML#Self-contained file]]
// @tg: verifies:: [[openspec:graph-export#Export the graph as standalone HTML#Same layout as the panel]]
it('builds one HTML page that loads nothing, keeps positions and cannot be broken by a note title', () => {
  const html = buildHtml({
    ...META,
    elements: { nodes: [{ id: 'a.md', label: '</script><img src=x onerror=alert(1)>', labels: ['Note'], stub: false, path: 'a.md', props: { title: 'x' } }], edges: [] },
    positions: { 'a.md': { x: 12, y: 34 } },
    theme: { text: '#111', muted: '#666', background: '#fff' },
    viewerScript: 'console.log("</script>");',
  });
  expect(html).toContain("default-src 'none'");
  expect(html).not.toMatch(/(src|href)=["']https?:/i);
  expect(html).not.toContain('<link');
  expect(html.match(/<\/script>/g)).toHaveLength(2);
  expect(html).not.toContain('<img src=x');
  const data = JSON.parse(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)![1]!) as { elements: { nodes: { label: string }[] }; positions: Record<string, { x: number; y: number }> };
  expect(data.elements.nodes[0]!.label).toBe('</script><img src=x onerror=alert(1)>');
  expect(data.positions['a.md']).toEqual({ x: 12, y: 34 });
  expect(exportFileName('project', 'html', META.date)).toBe('typegraph-project-2026-10-14.html');
});

// @tg: verifies:: [[tests/vscode-extension#Graph export#Inspect a node]] {since: "2026-10-14", level: unit}
// @lat: [[tests/vscode-extension#Graph export#Inspect a node]]
// @tg: verifies:: [[openspec:graph-export#Export the graph as standalone HTML#Reader can inspect a node]]
it('ships a viewer that lists a selected node through text content only', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'src', 'webview', 'viewer.ts'), 'utf8');
  expect(src).toContain('onSelect');
  expect(src).toContain('n.labels.join');
  expect(src).not.toMatch(/innerHTML|insertAdjacentHTML|document\.write/);
});

function xrefOffsetsMatch(pdf: string): boolean {
  const start = Number(/startxref\n(\d+)\n%%EOF/.exec(pdf)![1]);
  if (!pdf.startsWith('xref', start)) return false;
  const rows = [...pdf.slice(start).matchAll(/^(\d{10}) \d{5} n $/gm)].map((m) => Number(m[1]));
  return rows.length > 0 && rows.every((off, i) => pdf.startsWith(`${i + 1} 0 obj`, off));
}

// @tg: verifies:: [[tests/vscode-extension#Graph export#Valid vector PDF]] {since: "2026-10-14", level: unit}
// @lat: [[tests/vscode-extension#Graph export#Valid vector PDF]]
// @tg: verifies:: [[openspec:graph-export#Export the graph as PDF#Valid PDF]]
// @tg: verifies:: [[openspec:graph-export#Export the graph as PDF#Vector output]]
// @tg: verifies:: [[openspec:graph-export#Export the graph as PDF#Whole graph on one page]]
it('writes a valid one-page PDF of paths and text with no image, and labels can be found in it', () => {
  const pdf = buildGraphPdf(SCENE, META).toString('latin1');
  expect(pdf.startsWith('%PDF-')).toBe(true);
  expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  expect(xrefOffsetsMatch(pdf)).toBe(true);
  expect(pdf).not.toMatch(/\/Subtype\s*\/Image|DCTDecode|\/XObject/);
  expect(pdf).toMatch(/ c\b/);
  expect(pdf).toMatch(/ l\b/);
  expect(pdf).toContain('(Alice \\(CEO\\)) Tj');
  expect(pdf).toContain('(Zoë \\\\ Bob) Tj');
  expect(pdf).toContain('(Ghost) Tj');
  expect(pdf.match(/\/Type \/Page /g)).toHaveLength(1);
  const length = Number(/\/Length (\d+)/.exec(pdf)![1]);
  expect(pdf.slice(pdf.indexOf('stream\n') + 7).indexOf('\nendstream')).toBe(length);
});

// @tg: verifies:: [[tests/vscode-extension#Graph export#PDF size metadata]] {since: "2026-10-14", level: unit}
// @lat: [[tests/vscode-extension#Graph export#PDF size metadata]]
// @tg: verifies:: [[openspec:graph-export#Export the graph as PDF#Size metadata]]
// @tg: verifies:: [[openspec:graph-export#Export the graph as PDF#Capped graph says so]]
it('states the scope and counts in the caption and Subject, and what a capped graph left out', () => {
  const plain = buildGraphPdf(SCENE, META).toString('latin1');
  expect(plain).toContain('/Subject (Whole project: 3 nodes, 3 edges)');
  expect(plain).toContain('(Whole project: 3 nodes, 3 edges  |  2026-10-14) Tj');
  const capped = buildGraphPdf(SCENE, { ...META, omitted: 17, limit: 3 }).toString('latin1');
  expect(capped).toContain('/Subject (Whole project: 3 nodes, 3 edges, 17 nodes left out \\(limit 3\\))');
  expect(sizeSummary(1, 1, { scope: 'file', omitted: 0, limit: 10 })).toBe('Active file: 1 node, 1 edge');
});

// @tg: verifies:: [[tests/vscode-extension#Graph export#PDF page limit]] {since: "2026-10-14", level: unit}
// @lat: [[tests/vscode-extension#Graph export#PDF page limit]]
// @tg: verifies:: [[openspec:graph-export#Export the graph as PDF#Print-friendly colors in a dark theme]]
it('paints a white page with black labels from element colors alone, and scales a huge graph under the page limit', () => {
  const pdf = buildGraphPdf(SCENE, META).toString('latin1');
  expect(pdf).toContain('1 1 1 rg\n0 0 ');
  expect(pdf).toMatch(/BT 0 g \/F1 11 Tf/);
  const huge: Scene = { nodes: [{ ...SCENE.nodes[0]!, x: 0 }, { ...SCENE.nodes[1]!, x: 60000 }], edges: [] };
  const big = buildGraphPdf(huge, META).toString('latin1');
  const [w, h] = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(big)!.slice(1).map(Number);
  expect(Math.max(w!, h!)).toBeLessThanOrEqual(14400);
  expect(xrefOffsetsMatch(big)).toBe(true);
});

// @tg: verifies:: [[tests/vscode-extension#Graph export#Commands and buttons]] {since: "2026-10-14", level: unit}
// @lat: [[tests/vscode-extension#Graph export#Commands and buttons]]
// @tg: verifies:: [[openspec:graph-export#Export commands from the editor and the panel#Buttons in the title bar]]
it('contributes the three commands, their title-bar buttons and the limit setting', () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')) as {
    contributes: { commands: { command: string; title: string }[]; menus: { 'view/title': { command: string; when: string }[] }; configuration: { properties: Record<string, { default: unknown }> } };
  };
  const cmds = pkg.contributes.commands.map((c) => c.command);
  for (const c of ['typegraph.openGraph', 'typegraph.openFullGraph', 'typegraph.exportGraphHtml', 'typegraph.exportGraphPdf']) {
    expect(cmds).toContain(c);
    expect(pkg.contributes.menus['view/title'].some((m) => m.command === c && m.when === 'view == typegraph.backlinks')).toBe(true);
  }
  expect(pkg.contributes.commands.find((c) => c.command === 'typegraph.openFullGraph')!.title).toBe('TypeGraph: Open Full Graph');
  expect(pkg.contributes.configuration.properties['typegraph.fullGraphLimit']!.default).toBe(2000);
  expect(readFileSync(join(import.meta.dirname, '..', '.vscodeignore'), 'utf8')).toContain('!dist/viewer.js');
});
