import { GraphRenderer, makeStyler, type EdgeElement, type GraphElements, type NodeElement } from '@obsigraph/graph-ui';

/** The standalone page's script: draws the embedded graph at its saved positions and shows details on selection. */
const data = JSON.parse(document.getElementById('data')!.textContent!) as {
  elements: GraphElements;
  positions: Record<string, { x: number; y: number }>;
  theme: { text: string; muted: string; background: string };
};
const details = document.getElementById('details')!;
const nodes = new Map<string, NodeElement>(data.elements.nodes.map((n) => [n.id, n]));
const edges = new Map<string, EdgeElement>(data.elements.edges.map((e) => [e.id, e]));

const show = (title: string, rows: [string, string][]) => {
  details.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = title;
  const dl = document.createElement('dl');
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  details.append(h, dl);
  details.classList.add('open');
};

const renderer = new GraphRenderer(document.getElementById('graph')!, {
  height: window.innerHeight,
  styler: makeStyler([]),
  theme: () => data.theme,
  positions: data.positions,
  onSelect: (sel) => {
    if (!sel) {
      details.classList.remove('open');
      return;
    }
    if (sel.kind === 'node') {
      const n = nodes.get(sel.id);
      if (!n) return;
      show(n.label, [['Labels', n.labels.join(', ')], ['Path', n.path ?? '(not a file)'], ...Object.entries(n.props).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)] as [string, string])]);
    } else {
      const e = edges.get(sel.id);
      if (e) show(`${e.sign < 0 ? '-' : ''}${e.type}`, [['From', nodes.get(e.source)?.label ?? e.source], ['To', nodes.get(e.target)?.label ?? e.target]]);
    }
  },
});
renderer.setElements(data.elements);
window.addEventListener('resize', () => {
  renderer.container.style.height = `${window.innerHeight}px`;
  renderer.cy.resize();
});
