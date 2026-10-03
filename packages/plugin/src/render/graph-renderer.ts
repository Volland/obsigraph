import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import type { GraphElements } from './elements';
import { buildStylesheet, nodeClasses, type Theme, type TypeStyles } from './styles';

export interface RendererOptions {
  height: number;
  styles: TypeStyles;
  /** Called on double-click or modifier-click of a non-stub node. */
  onOpen?: (path: string) => void;
  /** Called when the selection changes; null when cleared. */
  onSelect?: (sel: { kind: 'node' | 'edge'; id: string } | null) => void;
  /** Called when a node's expand action fires (right-click / long-press). */
  onExpand?: (id: string) => void;
}

/** Read Obsidian theme colors so the graph matches light and dark mode. */
export function themeFrom(el: HTMLElement): Theme {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    text: v('--text-normal', '#222'),
    muted: v('--text-faint', '#999'),
    background: v('--background-primary', '#fff'),
  };
}

/**
 * Shared Cytoscape renderer for inline query blocks and the Graph view, so an
 * element looks the same everywhere.
 */
// @lat: [[visualization#Surfaces]]
export class GraphRenderer {
  readonly cy: Core;
  private styles: TypeStyles;

  constructor(
    readonly container: HTMLElement,
    private readonly opts: RendererOptions,
  ) {
    this.styles = opts.styles;
    container.style.height = `${opts.height}px`;
    container.addClass('obsigraph-graph');
    this.cy = cytoscape({ container, elements: [], wheelSensitivity: 0.3, minZoom: 0.1, maxZoom: 4 });

    this.cy.on('dbltap', 'node', (e) => this.open(e.target.data('path')));
    this.cy.on('tap', 'node', (e) => {
      const orig = e.originalEvent as MouseEvent | undefined;
      if (orig && (orig.metaKey || orig.ctrlKey)) this.open(e.target.data('path'));
    });
    this.cy.on('cxttap taphold', 'node', (e) => opts.onExpand?.(e.target.id()));
    this.cy.on('select', 'node, edge', (e) => opts.onSelect?.({ kind: e.target.isNode() ? 'node' : 'edge', id: e.target.id() }));
    this.cy.on('unselect', () => {
      if (this.cy.$(':selected').empty()) opts.onSelect?.(null);
    });
  }

  /** Replace all elements and re-layout. */
  setElements(g: GraphElements): void {
    this.cy.batch(() => {
      this.cy.elements().remove();
      this.cy.add(toDefinitions(g));
    });
    this.restyle();
    this.layout(this.cy.elements());
  }

  /** Add elements without discarding existing ones; lays out only around new nodes. */
  addElements(g: GraphElements): void {
    const fresh = toDefinitions(g).filter((d) => this.cy.getElementById(d.data.id!).empty());
    if (fresh.length === 0) return;
    const added = this.cy.add(fresh);
    this.restyle();
    this.layout(this.cy.elements(), added.nodes().length > 0);
  }

  setStyles(styles: TypeStyles): void {
    this.styles = styles;
    this.restyle();
  }

  destroy(): void {
    this.cy.destroy();
  }

  private restyle(): void {
    const labels = new Set<string>();
    this.cy.nodes().forEach((n) => (n.data('labels') as string[]).forEach((l) => labels.add(l)));
    this.cy.style(buildStylesheet(this.styles, labels, themeFrom(this.container)) as unknown as cytoscape.StylesheetJson);
  }

  private layout(eles: cytoscape.Collection, animate = false): void {
    if (eles.empty()) return;
    eles.layout({ name: 'cose', animate, padding: 24, nodeRepulsion: () => 9000, idealEdgeLength: () => 90 } as cytoscape.LayoutOptions).run();
  }

  private open(path: unknown): void {
    if (typeof path === 'string' && path) this.opts.onOpen?.(path);
  }
}

function toDefinitions(g: GraphElements): ElementDefinition[] {
  return [
    ...g.nodes.map((n) => ({
      group: 'nodes' as const,
      data: { id: n.id, label: n.label, labels: n.labels, path: n.path ?? '' },
      classes: nodeClasses(n.labels, n.stub),
    })),
    ...g.edges.map((e) => ({
      group: 'edges' as const,
      data: { id: e.id, source: e.source, target: e.target, type: e.sign < 0 ? `−${e.type}` : e.type, sign: e.sign },
      classes: e.sign < 0 ? ['negative'] : [],
    })),
  ];
}
