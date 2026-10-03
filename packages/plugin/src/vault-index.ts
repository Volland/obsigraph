import { BuiltinEngine, Graph, type NoteInput } from '@obsigraph/core';
import { TFile, type App, type EventRef } from 'obsidian';

const BATCH = 100;

/**
 * Keeps the core graph in sync with the vault. Reads note text and frontmatter
 * through Obsidian, resolves links with the metadata cache, never writes notes.
 */
// @lat: [[architecture#Source of truth]]
export class VaultIndex {
  readonly graph: Graph;
  readonly engine: BuiltinEngine;
  ready = false;

  private readonly listeners = new Set<() => void>();
  private timer: number | null = null;
  private readonly refs: EventRef[] = [];

  constructor(
    private readonly app: App,
    private readonly debounceMs: () => number,
  ) {
    this.graph = new Graph((link, source) => {
      const f = this.app.metadataCache.getFirstLinkpathDest(link, source);
      return f && f.extension === 'md' ? f.path : null;
    });
    this.engine = new BuiltinEngine(this.graph);
    this.graph.onChange(() => this.schedule());
  }

  /** Index every markdown note in batches, yielding to the UI between them. */
  async build(onProgress?: (done: number, total: number) => void): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    for (let i = 0; i < files.length; i += BATCH) {
      for (const f of files.slice(i, i + BATCH)) this.graph.upsertNote(await this.read(f));
      onProgress?.(Math.min(i + BATCH, files.length), files.length);
      await new Promise((r) => window.setTimeout(r, 0));
    }
    this.ready = true;
    this.flush();
  }

  /** Start listening for vault changes; returns event refs for the plugin to register. */
  watch(): EventRef[] {
    const { metadataCache, vault } = this.app;
    this.refs.push(
      metadataCache.on('changed', (file, data, cache) => {
        if (file.extension !== 'md') return;
        this.graph.upsertNote({ path: file.path, text: data, frontmatter: cache.frontmatter ?? null });
      }),
      vault.on('delete', (file) => {
        if (file instanceof TFile && file.extension === 'md') this.graph.removeNote(file.path);
      }),
      vault.on('rename', async (file, oldPath) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        this.graph.renameNote(oldPath, await this.read(file));
      }),
    );
    return this.refs;
  }

  /** Subscribe to debounced change notifications; returns an unsubscribe function. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  destroy(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.listeners.clear();
  }

  private async read(file: TFile): Promise<NoteInput> {
    return {
      path: file.path,
      text: await this.app.vault.cachedRead(file),
      frontmatter: this.app.metadataCache.getFileCache(file)?.frontmatter ?? null,
    };
  }

  private schedule(): void {
    if (!this.ready) return;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(), this.debounceMs());
  }

  private flush(): void {
    this.timer = null;
    for (const fn of this.listeners) fn();
  }
}
