import { buildCodeLayer, langOfFile, splitTarget, upsertCodeNode, type CodeMode, type Graph } from '@obsigraph/core';
import { TFile, type App } from 'obsidian';

const MAX_BYTES = 1_500_000;

/**
 * Derived code nodes in the vault graph: scans source files in the vault
 * (read-only), turns annotated or all symbols into `CodeFile` and `CodeSymbol`
 * nodes and keeps them current as files change. Nothing is ever written.
 */
// @lat: [[cli#Code layer]]
export class CodeLayer {
  private readonly texts = new Map<string, string>();
  private inserted = new Set<string>();
  private loaded = false;

  constructor(
    private readonly app: App,
    private readonly graph: Graph,
    private readonly mode: () => CodeMode,
    private readonly root: () => string,
  ) {}

  /** True for vault files the layer reads: a supported language under the code folder. */
  accepts(path: string): boolean {
    const root = this.root().replace(/^\/+|\/+$/g, '');
    return langOfFile(path) !== null && (root === '' || path.startsWith(`${root}/`));
  }

  /** Read every source file once; later changes arrive through {@link update}. */
  async load(): Promise<void> {
    if (this.mode() === 'off') return;
    this.texts.clear();
    for (const f of this.app.vault.getFiles()) {
      if (!this.accepts(f.path) || f.stat.size > MAX_BYTES) continue;
      this.texts.set(f.path, await this.app.vault.cachedRead(f));
    }
    this.loaded = true;
    this.rebuild();
  }

  async update(file: TFile): Promise<void> {
    if (this.mode() === 'off' || !this.accepts(file.path)) return;
    if (!this.loaded) return this.load();
    this.texts.set(file.path, await this.app.vault.cachedRead(file));
    this.rebuild();
  }

  remove(path: string): void {
    if (this.texts.delete(path)) this.rebuild();
  }

  rename(file: TFile, oldPath: string): void {
    this.texts.delete(oldPath);
    void this.update(file);
  }

  /** The mode setting changed: load on first use, drop everything when off. */
  async refresh(): Promise<void> {
    if (this.mode() === 'off') {
      this.clear();
      return;
    }
    if (!this.loaded) await this.load();
    else this.rebuild();
  }

  /** Recompute the layer from the cached texts and sync the graph with it. */
  rebuild(): void {
    const layer = buildCodeLayer(
      [...this.texts].map(([path, text]) => ({ path, text })),
      this.mode(),
      (target, source) => {
        const f = this.app.metadataCache.getFirstLinkpathDest(splitTarget(target).file, source);
        return f && f.extension === 'md' ? f.path : null;
      },
    );
    const next = new Set(layer.nodes.map((n) => n.path));
    for (const path of this.inserted) if (!next.has(path)) this.graph.removeNote(path);
    for (const n of layer.nodes) upsertCodeNode(this.graph, n);
    this.inserted = next;
  }

  private clear(): void {
    for (const path of this.inserted) this.graph.removeNote(path);
    this.inserted = new Set();
    this.texts.clear();
    this.loaded = false;
  }
}
