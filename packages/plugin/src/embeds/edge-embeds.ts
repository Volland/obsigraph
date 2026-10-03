import { findEmbeds, parseEmbed, resolveEmbed, viewEmbed, EMBED_PATTERN, type EdgeEmbed, type EmbedView } from '@obsigraph/core';
import { RangeSetBuilder, StateEffect, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField, MarkdownRenderChild, type MarkdownPostProcessorContext } from 'obsidian';
import type ObsigraphPlugin from '../main';

/** Render an embed view into `el`: a value, a small table, an empty state or an unresolved marker. */
export function renderEmbedView(el: HTMLElement, view: EmbedView, raw: string): void {
  el.empty();
  el.className = `obsigraph-embed obsigraph-embed-${view.kind}`;
  el.setAttribute('title', raw);
  switch (view.kind) {
    case 'value':
      el.setText(view.text);
      return;
    case 'empty':
      el.setText(`(${view.text})`);
      return;
    case 'unresolved':
      el.setText(`⚠ ${view.text}`);
      return;
    case 'table': {
      const table = el.createEl('table');
      for (const [k, v] of view.rows) {
        const tr = table.createEl('tr');
        tr.createEl('th', { text: k });
        tr.createEl('td', { text: v });
      }
    }
  }
}

function compute(plugin: ObsigraphPlugin, embed: EdgeEmbed | string, path: string): EmbedView {
  if (typeof embed === 'string') return { kind: 'unresolved', text: embed };
  if (!plugin.index.ready) return { kind: 'unresolved', text: 'indexing…' };
  return viewEmbed(embed, resolveEmbed(plugin.index.graph, embed, path));
}

/** One embed in reading view; re-renders when the vault changes. */
class EmbedChild extends MarkdownRenderChild {
  constructor(
    el: HTMLElement,
    private readonly raw: string,
    private readonly embed: EdgeEmbed | string,
    private readonly path: string,
    private readonly plugin: ObsigraphPlugin,
  ) {
    super(el);
  }
  onload(): void {
    this.render();
    this.register(this.plugin.index.onChange(() => this.render()));
  }
  private render(): void {
    renderEmbedView(this.containerEl, compute(this.plugin, this.embed, this.path), this.raw);
  }
}

/** Reading view: replace `{{edge: ...}}` in text nodes outside code. */
// @lat: [[edge-syntax#Property embeds]]
export function edgeEmbedPostProcessor(plugin: ObsigraphPlugin) {
  return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement?.closest('code, pre, .obsigraph-embed') ? NodeFilter.FILTER_REJECT : n.nodeValue?.includes('{{') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
    });
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const text = node.nodeValue ?? '';
      const matches = [...text.matchAll(EMBED_PATTERN)];
      if (matches.length === 0) continue;
      const frag = document.createDocumentFragment();
      let last = 0;
      for (const m of matches) {
        frag.append(text.slice(last, m.index));
        const span = createSpan();
        frag.append(span);
        ctx.addChild(new EmbedChild(span, m[0], parseEmbed(m[1]!), ctx.sourcePath, plugin));
        last = m.index! + m[0].length;
      }
      frag.append(text.slice(last));
      node.replaceWith(frag);
    }
  };
}

class EmbedWidget extends WidgetType {
  constructor(
    private readonly raw: string,
    private readonly view: EmbedView,
  ) {
    super();
  }
  eq(other: EmbedWidget): boolean {
    return other.raw === this.raw && JSON.stringify(other.view) === JSON.stringify(this.view);
  }
  toDOM(): HTMLElement {
    const span = createSpan();
    renderEmbedView(span, this.view, this.raw);
    return span;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

/** Dispatched to open editors when the graph changes, so embeds re-resolve. */
export const refreshEmbeds = StateEffect.define<null>();

/**
 * Live preview: embeds render as widgets except where the cursor or selection
 * touches them, so the raw text stays editable.
 */
// @lat: [[edge-syntax#Property embeds]]
export function edgeEmbedEditorExtension(plugin: ObsigraphPlugin, views: Set<EditorView>): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(readonly view: EditorView) {
        views.add(view);
        this.decorations = this.build();
      }
      update(u: ViewUpdate): void {
        const refreshed = u.transactions.some((t) => t.effects.some((e) => e.is(refreshEmbeds)));
        if (u.docChanged || u.selectionSet || u.viewportChanged || refreshed) this.decorations = this.build();
      }
      destroy(): void {
        views.delete(this.view);
      }
      build(): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const state = this.view.state;
        if (!state.field(editorLivePreviewField, false)) return builder.finish();
        const path = state.field(editorInfoField, false)?.file?.path ?? '';
        const doc = state.doc;
        const sel = state.selection.ranges;
        for (const occ of findEmbeds(doc.toString())) {
          const from = doc.line(occ.line + 1).from + occ.column;
          const to = from + occ.raw.length;
          if (sel.some((r) => r.from <= to && r.to >= from)) continue;
          const view = compute(plugin, occ.embed ?? occ.error ?? 'malformed embed', path);
          builder.add(from, to, Decoration.replace({ widget: new EmbedWidget(occ.raw, view) }));
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}
