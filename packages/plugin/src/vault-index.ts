import {
  BuiltinEngine,
  EmbedIndex,
  Graph,
  schemasFromGraph,
  styleSource,
  styleSourcesFromSchemas,
  validateSchemas,
  type Diagnostic,
  type ExecOptions,
  type IconCheck,
  type NoteInput,
  type SchemaSet,
  type StyleSource,
} from '@obsigraph/core';
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
  readonly embeds = new EmbedIndex();
  ready = false;

  private readonly listeners = new Set<() => void>();
  private timer: number | null = null;
  private readonly refs: EventRef[] = [];
  private schemaCache: SchemaSet | null = null;
  private diagnosticCache: Diagnostic[] | null = null;
  private styleCache: { sources: StyleSource[]; diagnostics: Diagnostic[] } | null = null;

  constructor(
    private readonly app: App,
    private readonly debounceMs: () => number,
    private readonly schemaFolder: () => string,
    private readonly settingsStyles: () => { nodes: Record<string, unknown>; edges: Record<string, unknown> },
    private readonly iconExists: IconCheck,
    engineOptions: () => ExecOptions = () => ({}),
  ) {
    this.graph = new Graph((link, source) => {
      const f = this.app.metadataCache.getFirstLinkpathDest(link, source);
      return f && f.extension === 'md' ? f.path : null;
    });
    this.engine = new BuiltinEngine(this.graph, engineOptions);
    this.graph.onChange(() => {
      this.invalidate();
      this.schedule();
    });
  }

  /** Type schemas from the schema folder, cached until the next vault change. */
  // @lat: [[graph-model#Schema notes]]
  schemas(): SchemaSet {
    return (this.schemaCache ??= schemasFromGraph(this.graph, this.schemaFolder()));
  }

  /** Parse, schema and validation diagnostics for the whole vault. */
  diagnostics(): Diagnostic[] {
    if (!this.diagnosticCache) {
      const set = this.schemas();
      this.diagnosticCache = [
        ...this.graph.diagnostics(),
        ...set.diagnostics,
        ...validateSchemas(this.graph, set),
        ...this.styleSources().diagnostics,
        ...this.embeds.warnings(this.graph),
      ];
    }
    return this.diagnosticCache;
  }

  /**
   * Style sources below the block header, in precedence order: one per schema
   * note, then plugin settings. Invalid values become diagnostics.
   */
  // @lat: [[visualization#Styling]]
  styleSources(): { sources: StyleSource[]; diagnostics: Diagnostic[] } {
    if (!this.styleCache) {
      const schemas = styleSourcesFromSchemas(this.schemas().schemas, this.iconExists);
      const { nodes, edges } = this.settingsStyles();
      const settings = styleSource('settings', null, nodes, edges, this.iconExists);
      this.styleCache = {
        sources: [...schemas.sources, settings.source],
        diagnostics: [...schemas.diagnostics, ...settings.diagnostics],
      };
    }
    return this.styleCache;
  }

  /** Drop cached schemas and styles, e.g. after settings change. */
  invalidate(): void {
    this.schemaCache = null;
    this.diagnosticCache = null;
    this.styleCache = null;
  }

  /** Index every markdown note in batches, yielding to the UI between them. */
  async build(onProgress?: (done: number, total: number) => void): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    for (let i = 0; i < files.length; i += BATCH) {
      for (const f of files.slice(i, i + BATCH)) this.upsert(await this.read(f));
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
        this.upsert({ path: file.path, text: data, frontmatter: cache.frontmatter ?? null });
      }),
      vault.on('delete', (file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        this.embeds.remove(file.path);
        this.graph.removeNote(file.path);
      }),
      vault.on('rename', async (file, oldPath) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        const note = await this.read(file);
        this.embeds.remove(oldPath);
        this.embeds.upsert(note.path, note.text);
        this.graph.renameNote(oldPath, note);
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

  /** Embeds first, so the graph change notification sees current embeds. */
  private upsert(note: NoteInput): void {
    this.embeds.upsert(note.path, note.text);
    this.graph.upsertNote(note);
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
