import { GraphRenderer, makeStyler, type GraphElements } from '@obsigraph/graph-ui';

interface Vscode {
  postMessage(message: unknown): void;
}
declare function acquireVsCodeApi(): Vscode;

const vscode = acquireVsCodeApi();
const host = document.getElementById('graph')!;

/** VS Code exposes its theme as CSS variables; the shared renderer takes them as plain colors. */
const theme = () => {
  const css = getComputedStyle(document.body);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return { text: v('--vscode-editor-foreground', '#ccc'), muted: v('--vscode-descriptionForeground', '#888'), background: v('--vscode-editor-background', '#1e1e1e') };
};

const renderer = new GraphRenderer(host, {
  height: window.innerHeight,
  styler: makeStyler([]),
  theme,
  onOpen: (path) => vscode.postMessage({ type: 'open', path }),
  onExpand: (id) => vscode.postMessage({ type: 'expand', id }),
});
host.style.height = '100vh';
window.addEventListener('resize', () => renderer.cy.resize());

window.addEventListener('message', (e: MessageEvent<{ type: string; elements?: GraphElements }>) => {
  if (e.data.type === 'elements' && e.data.elements) renderer.setElements(e.data.elements);
});
vscode.postMessage({ type: 'ready' });
