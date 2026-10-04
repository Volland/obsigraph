import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import { sameElementSet, type EdgeElement, type GraphElements, type NodeElement } from './elements';
import { buildStylesheet, type Theme } from './styles';
import type { Styler } from './styler';

export interface RendererOptions {
  height: number;
  styler: Styler;
  /** Colors for text and background, read from the host on every restyle so the graph follows theme changes. */
  theme: () => Theme;
  /** Called on double-click or modifier-click of a non-stub node. */
  onOpen?: (path: string) => void;
  /** Called when the selection changes; null when cleared. */
  onSelect?: (sel: { kind: 'node' | 'edge'; id: string } | null) => void;
  /** Called when a node's expand action fires (right-click / long-press). */
  onExpand?: (id: string) => void;
}

/**
 * Shared Cytoscape renderer for inline query blocks and the Graph view, so an
 * element looks the same everywhere. Visual attributes come from a styler and
 * are stored as element data, so restyling never moves nodes.
 */
// @lat: [[visualization#Surfaces]]
export class GraphRenderer {
  readonly cy: Core;
  private styler: Styler;
  private readonly model = new Map<string, NodeElement | EdgeElement>();

  constructor(
    readonly container: HTMLElement,
    private readonly opts: RendererOptions,
  ) {
    this.styler = opts.styler;
    container.style.height = `${opts.height}px`;
    container.classList.add('obsigraph-graph');
    this.cy = cytoscape({ container, elements: [], wheelSensitivity: 0.3, minZoom: 0.1, maxZoom: 4 });
    this.cy.style(buildStylesheet(opts.theme()));

    const target = (e: cytoscape.EventObject) => e.target as cytoscape.SingularElementReturnValue;
    this.cy.on('dbltap', 'node', (e) => this.open(target(e).data('path') as unknown));
    this.cy.on('tap', 'node', (e) => {
      const orig = e.originalEvent as MouseEvent | undefined;
      if (orig && (orig.metaKey || orig.ctrlKey)) this.open(target(e).data('path') as unknown);
    });
    this.cy.on('cxttap taphold', 'node', (e) => opts.onExpand?.(target(e).id()));
    this.cy.on('select', 'node, edge', (e) => opts.onSelect?.({ kind: target(e).isNode() ? 'node' : 'edge', id: target(e).id() }));
    this.cy.on('unselect', () => {
      if (this.cy.$(':selected').empty()) opts.onSelect?.(null);
    });
  }

  /**
   * Show exactly these elements. When the element set is unchanged only data
   * is refreshed, so live updates keep node positions.
   */
  setElements(g: GraphElements): void {
    const same = sameElementSet(this.model, g);
    this.model.clear();
    for (const x of [...g.nodes, ...g.edges]) this.model.set(x.id, x);
    if (same) {
      this.restyle();
      return;
    }
    this.cy.batch(() => {
      this.cy.elements().remove();
      this.cy.add(this.definitions(g));
    });
    this.layout(this.cy.elements());
  }

  /** Add elements without discarding existing ones. */
  addElements(g: GraphElements): void {
    const fresh = [...g.nodes, ...g.edges].filter((x) => !this.model.has(x.id));
    if (fresh.length === 0) return;
    for (const x of fresh) this.model.set(x.id, x);
    const added = this.cy.add(this.definitions({ nodes: g.nodes.filter((n) => fresh.includes(n)), edges: g.edges.filter((e) => fresh.includes(e)) }));
    this.layout(this.cy.elements(), added.nodes().length > 0);
  }

  /** Swap the styler and update element data in place, without re-layout. */
  setStyler(styler: Styler): void {
    this.styler = styler;
    this.restyle();
  }

  destroy(): void {
    this.cy.destroy();
  }

  private restyle(): void {
    this.cy.batch(() => {
      this.cy.style(buildStylesheet(this.opts.theme()));
      for (const [id, x] of this.model) {
        const ele = this.cy.getElementById(id);
        if (ele.nonempty()) ele.data(isEdge(x) ? this.styler.edge(x) : { ...this.styler.node(x) });
      }
    });
  }

  private definitions(g: GraphElements): ElementDefinition[] {
    return [
      ...g.nodes.map((n) => ({
        group: 'nodes' as const,
        data: { id: n.id, labels: n.labels, path: n.path ?? '', ...this.styler.node(n) },
        classes: n.stub ? ['stub'] : [],
      })),
      ...g.edges.map((e) => ({
        group: 'edges' as const,
        data: { id: e.id, source: e.source, target: e.target, type: e.sign < 0 ? `−${e.type}` : e.type, sign: e.sign, ...this.styler.edge(e) },
        classes: e.sign < 0 ? ['negative'] : [],
      })),
    ];
  }

  private layout(eles: cytoscape.Collection, animate = false): void {
    if (eles.empty()) return;
    const options: cytoscape.CoseLayoutOptions = { name: 'cose', animate, padding: 24, nodeRepulsion: () => 9000, idealEdgeLength: () => 90 };
    eles.layout(options).run();
  }

  private open(path: unknown): void {
    if (typeof path === 'string' && path) this.opts.onOpen?.(path);
  }
}

function isEdge(x: NodeElement | EdgeElement): x is EdgeElement {
  return 'source' in x;
}
