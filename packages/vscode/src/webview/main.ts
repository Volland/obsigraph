import { GraphRenderer, makeStyler, type GraphElements } from '@obsigraph/graph-ui';
import type { Scene } from '../pdf';

interface Vscode {
  postMessage(message: unknown): void;
}
declare function acquireVsCodeApi(): Vscode;

interface View {
  elements: GraphElements;
  scope: 'file' | 'project';
  total: number;
  omitted: number;
  limit: number;
}

const vscode = acquireVsCodeApi();
const host = document.getElementById('graph')!;
const BAR = 34;

/** VS Code exposes its theme as CSS variables; the shared renderer takes them as plain colors. */
const theme = () => {
  const css = getComputedStyle(document.body);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return { text: v('--vscode-editor-foreground', '#ccc'), muted: v('--vscode-descriptionForeground', '#888'), background: v('--vscode-editor-background', '#1e1e1e') };
};

// Toolbar: scope toggle, size note, export buttons.
const bar = document.getElementById('bar')!;
const button = (label: string, title: string, onClick: () => void) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
};
const fileBtn = button('Active file', 'Show the active file and its neighbors', () => vscode.postMessage({ type: 'scope', scope: 'file' }));
const projectBtn = button('Whole project', 'Show every node and edge', () => vscode.postMessage({ type: 'scope', scope: 'project' }));
const note = document.createElement('span');
note.className = 'note';
const spacer = document.createElement('span');
spacer.className = 'spacer';
bar.append(fileBtn, projectBtn, note, spacer, button('Export HTML', 'Save the graph as a standalone HTML page', () => capture('html')), button('Export PDF', 'Save the graph as a vector PDF', () => capture('pdf')));

let view: View | null = null;

const renderer = new GraphRenderer(host, {
  height: window.innerHeight - BAR,
  styler: makeStyler([]),
  theme,
  onOpen: (path) => vscode.postMessage({ type: 'open', path }),
  onExpand: (id) => vscode.postMessage({ type: 'expand', id }),
});
window.addEventListener('resize', () => {
  host.style.height = `${window.innerHeight - BAR}px`;
  renderer.cy.resize();
});

const showView = (v: View) => {
  view = v;
  fileBtn.classList.toggle('on', v.scope === 'file');
  projectBtn.classList.toggle('on', v.scope === 'project');
  const { nodes, edges } = v.elements;
  note.textContent = v.omitted > 0 ? `${nodes.length} of ${v.total} nodes shown (most connected; limit ${v.limit}), ${edges.length} edges` : `${nodes.length} nodes, ${edges.length} edges`;
  renderer.setElements(v.elements);
};

/** Read what the export needs from the live graph and send it to the extension, which writes the file. */
function capture(format: 'html' | 'pdf'): void {
  if (!view) return;
  if (format === 'html') {
    const positions: Record<string, { x: number; y: number }> = {};
    renderer.cy.nodes().forEach((n) => {
      positions[n.id()] = { x: n.position('x'), y: n.position('y') };
    });
    vscode.postMessage({ type: 'export', format, positions, theme: theme() });
    return;
  }
  const scene: Scene = {
    nodes: renderer.cy.nodes().map((n) => ({
      id: n.id(),
      x: n.position('x'),
      y: n.position('y'),
      w: n.width(),
      h: n.height(),
      shape: String(n.data('shape') ?? 'ellipse'),
      color: String(n.data('color') ?? '#888'),
      label: String(n.data('label') ?? n.id()),
      stub: n.hasClass('stub'),
    })),
    edges: renderer.cy.edges().map((e) => ({
      source: e.data('source') as string,
      target: e.data('target') as string,
      color: String(e.data('color') ?? '#888'),
      line: String(e.data('line') ?? 'solid'),
      negative: e.hasClass('negative'),
      label: String(e.data('type') ?? ''),
    })),
  };
  vscode.postMessage({ type: 'export', format, scene });
}

window.addEventListener('message', (e: MessageEvent<{ type: string } & Partial<View> & { format?: 'html' | 'pdf' }>) => {
  if (e.data.type === 'elements' && e.data.elements) showView(e.data as View);
  else if (e.data.type === 'capture' && e.data.format) capture(e.data.format);
});
vscode.postMessage({ type: 'ready' });
