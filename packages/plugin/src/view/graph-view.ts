import { CypherError } from '@obsigraph/core';
import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type ObsigraphPlugin from '../main';
import { DEFAULT_OPTIONS } from '../query/block';
import { planRender } from '../query/plan';
import type { GraphElements } from '../render/elements';
import { GraphRenderer } from '../render/graph-renderer';
import { renderTable } from '../render/table';
import { edgeDetails, mergeElements, neighborhood, nodeDetails, type Details } from './view-state';

export const VIEW_TYPE_GRAPH = 'obsigraph-graph-view';

/**
 * Full-pane exploratory graph. With an empty query it shows the active note's
 * neighborhood; right-click or long-press expands a node in place.
 */
// @lat: [[visualization#Surfaces]]
export class GraphView extends ItemView {
  private renderer: GraphRenderer | null = null;
  private input!: HTMLTextAreaElement;
  private body!: HTMLElement;
  private details!: HTMLElement;
  private message!: HTMLElement;
  private query = '';
  private focus: string | null = null;
  private readonly expanded = new Set<string>();

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ObsigraphPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_GRAPH;
  }
  getDisplayText(): string {
    return 'Typed Graph';
  }
  getIcon(): string {
    return 'git-fork';
  }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass('obsigraph-view');

    const bar = root.createDiv({ cls: 'obsigraph-querybar' });
    this.input = bar.createEl('textarea', {
      attr: { rows: '2', placeholder: 'MATCH (a)-[r]->(b) RETURN a, r, b — leave empty to follow the active note' },
    });
    const run = bar.createEl('button', { text: 'Run', cls: 'mod-cta' });
    run.addEventListener('click', () => this.submit());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.submit();
      }
    });

    this.message = root.createDiv({ cls: 'obsigraph-status' });
    const main = root.createDiv({ cls: 'obsigraph-view-main' });
    this.body = main.createDiv({ cls: 'obsigraph-view-body' });
    this.details = main.createDiv({ cls: 'obsigraph-details' });

    this.register(this.plugin.index.onChange(() => this.refresh()));
    this.register(this.plugin.onStylesChanged(() => this.refresh()));
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (this.query || !file || file.extension !== 'md') return;
        this.focus = file.path;
        this.expanded.clear();
        this.refresh();
      }),
    );
    this.focus = this.app.workspace.getActiveFile()?.path ?? null;
    this.refresh();
  }

  async onClose(): Promise<void> {
    this.renderer?.destroy();
    this.renderer = null;
  }

  private submit(): void {
    this.query = this.input.value.trim();
    this.expanded.clear();
    if (!this.query) this.focus = this.app.workspace.getActiveFile()?.path ?? this.focus;
    this.refresh();
  }

  /** Rebuild the current view, keeping nodes the user expanded. */
  private refresh(): void {
    if (!this.plugin.index.ready) {
      this.message.setText('Indexing vault…');
      return;
    }
    this.message.setText('');
    const graph = this.plugin.index.graph;
    let base: GraphElements;

    if (this.query) {
      let result;
      try {
        result = this.plugin.index.engine.run(this.query);
      } catch (e) {
        if (!(e instanceof CypherError)) throw e;
        this.showError(`${e.message}${e.line > 0 ? ` (line ${e.line}, column ${e.column})` : ''}`);
        return;
      }
      const plan = planRender(result, DEFAULT_OPTIONS, this.plugin.settings.maxElements, (id) => graph.node(id));
      if (plan.kind === 'error') return this.showError(plan.messages.join('\n'));
      if (plan.kind === 'table') {
        this.dropRenderer();
        this.body.empty();
        for (const n of [plan.notice, ...plan.notices]) if (n) this.body.createDiv({ cls: 'obsigraph-notice', text: n });
        renderTable(this.body, result, plan.indexes, (p) => this.openNote(p));
        return;
      }
      base = plan.elements;
      this.message.setText(plan.notices.join('\n'));
    } else if (this.focus && graph.node(this.focus)) {
      base = neighborhood(graph, this.focus);
    } else {
      this.dropRenderer();
      this.body.empty();
      this.message.setText('Open a note or enter a query.');
      return;
    }

    const elements = mergeElements(base, ...[...this.expanded].map((id) => neighborhood(graph, id)));
    const renderer = this.ensureRenderer();
    renderer.setStyler(this.plugin.makeStyler());
    renderer.setElements(elements);
  }

  private ensureRenderer(): GraphRenderer {
    if (this.renderer) return this.renderer;
    this.body.empty();
    const host = this.body.createDiv();
    this.renderer = new GraphRenderer(host, {
      height: 600,
      styler: this.plugin.makeStyler(),
      onOpen: (path) => this.openNote(path),
      onExpand: (id) => {
        this.expanded.add(id);
        this.renderer?.addElements(neighborhood(this.plugin.index.graph, id));
      },
      onSelect: (sel) => this.showDetails(sel),
    });
    host.style.height = '100%';
    host.style.minHeight = '320px';
    this.renderer.cy.resize();
    return this.renderer;
  }

  private showDetails(sel: { kind: 'node' | 'edge'; id: string } | null): void {
    this.details.empty();
    if (!sel) return;
    const graph = this.plugin.index.graph;
    let d: Details | null = null;
    const styler = this.plugin.makeStyler();
    if (sel.kind === 'node') {
      const n = graph.node(sel.id);
      if (n) d = nodeDetails(n, styler.resolveNode(n.labels));
    } else {
      const e = graph.edge(sel.id);
      if (e) d = edgeDetails(e, graph, styler.resolveEdge(e.type, e.sign));
    }
    if (!d) return;
    this.details.createEl('h4', { text: d.title });
    const table = this.details.createEl('table');
    for (const [k, v] of d.rows) {
      const tr = table.createEl('tr');
      tr.createEl('th', { text: k });
      tr.createEl('td', { text: v });
    }
  }

  private showError(msg: string): void {
    this.dropRenderer();
    this.body.empty();
    this.body.createDiv({ cls: 'obsigraph-error', text: msg });
  }

  private dropRenderer(): void {
    this.renderer?.destroy();
    this.renderer = null;
    this.details.empty();
  }

  private openNote(path: string): void {
    this.plugin.openNote(path, this.app.workspace.getActiveFile()?.path ?? '');
  }
}
