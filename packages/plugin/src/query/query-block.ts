import { CypherError } from '@obsigraph/core';
import { MarkdownRenderChild } from 'obsidian';
import type ObsigraphPlugin from '../main';
import { GraphRenderer } from '../render/graph-renderer';
import { renderTable } from '../render/table';
import { parseBlock } from './block';
import { planRender } from './plan';

/**
 * One rendered `graph-query` block. Re-runs on vault changes while visible;
 * changes that arrive while hidden are applied when it scrolls back into view.
 */
// @lat: [[query-engine#Query block]]
export class QueryBlock extends MarkdownRenderChild {
  private renderer: GraphRenderer | null = null;
  private visible = true;
  private dirty = false;
  private observer: IntersectionObserver | null = null;

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly plugin: ObsigraphPlugin,
  ) {
    super(containerEl);
  }

  onload(): void {
    this.containerEl.addClass('obsigraph-block');
    this.render();
    this.register(this.plugin.index.onChange(() => this.refresh()));
    this.register(this.plugin.onStylesChanged(() => this.renderer?.setStyles(this.plugin.settings.typeStyles)));
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver((entries) => {
        this.visible = entries.some((e) => e.isIntersecting);
        if (this.visible && this.dirty) this.refresh();
      });
      this.observer.observe(this.containerEl);
    }
  }

  onunload(): void {
    this.observer?.disconnect();
    this.renderer?.destroy();
    this.renderer = null;
  }

  private refresh(): void {
    if (!this.visible) {
      this.dirty = true;
      return;
    }
    this.dirty = false;
    this.render();
  }

  private render(): void {
    const el = this.containerEl;
    if (!this.plugin.index.ready) {
      el.empty();
      el.createDiv({ cls: 'obsigraph-status', text: 'Indexing vault…' });
      return;
    }

    const parsed = parseBlock(this.source);
    if (parsed.errors.length > 0) {
      return this.showErrors(parsed.errors.map((e) => `Line ${e.line + 1}: ${e.message}`));
    }

    let result;
    try {
      result = this.plugin.index.engine.run(parsed.query);
    } catch (e) {
      if (e instanceof CypherError) {
        // Map query positions back to lines in the block.
        const where = e.line > 0 ? ` (line ${e.line + parsed.queryLine}, column ${e.column})` : '';
        return this.showErrors([`${label(e.kind)}: ${e.message}${where}`]);
      }
      throw e;
    }

    const graph = this.plugin.index.graph;
    const plan = planRender(result, parsed.options, this.plugin.settings.maxElements, (id) => graph.node(id));
    if (plan.kind === 'error') return this.showErrors(plan.messages);

    if (plan.kind === 'graph') {
      // Reuse the renderer across refreshes to avoid flicker.
      if (!this.renderer) {
        el.empty();
        this.renderer = new GraphRenderer(el.createDiv(), {
          height: parsed.options.height,
          styles: this.plugin.settings.typeStyles,
          onOpen: (path) => this.plugin.openNote(path, this.sourcePath),
        });
      }
      this.renderer.setElements(plan.elements);
      return;
    }

    this.renderer?.destroy();
    this.renderer = null;
    const frag = createDiv();
    if (plan.notice) frag.createDiv({ cls: 'obsigraph-notice', text: plan.notice });
    renderTable(frag, result, plan.indexes, (path) => this.plugin.openNote(path, this.sourcePath));
    el.replaceChildren(...Array.from(frag.childNodes));
  }

  private showErrors(messages: string[]): void {
    this.renderer?.destroy();
    this.renderer = null;
    const el = this.containerEl;
    el.empty();
    const box = el.createDiv({ cls: 'obsigraph-error' });
    for (const m of messages) box.createDiv({ text: m });
  }
}

function label(kind: CypherError['kind']): string {
  return kind === 'syntax' ? 'Syntax error' : kind === 'unsupported' ? 'Unsupported' : kind === 'readonly' ? 'Read-only' : 'Query error';
}
