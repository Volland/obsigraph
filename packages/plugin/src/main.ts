import { Plugin } from 'obsidian';
import { QueryBlock } from './query/query-block';
import { DEFAULT_SETTINGS, ObsigraphSettingTab, type ObsigraphSettings } from './settings';
import { VaultIndex } from './vault-index';

// @lat: [[architecture#Standalone plugin]]
export default class ObsigraphPlugin extends Plugin {
  settings: ObsigraphSettings = DEFAULT_SETTINGS;
  index!: VaultIndex;
  private readonly styleListeners = new Set<() => void>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.index = new VaultIndex(this.app, () => this.settings.refreshDebounceMs);
    this.addSettingTab(new ObsigraphSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor('graph-query', (source, el, ctx) => {
      ctx.addChild(new QueryBlock(el, source, ctx.sourcePath, this));
    });

    this.app.workspace.onLayoutReady(async () => {
      for (const ref of this.index.watch()) this.registerEvent(ref);
      const status = this.addStatusBarItem();
      await this.index.build((done, total) => status.setText(`Obsigraph: indexing ${done}/${total}`));
      const { nodes, edges } = this.index.graph.size;
      status.setText(`Obsigraph: ${nodes} nodes, ${edges} edges`);
    });
  }

  onunload(): void {
    this.index?.destroy();
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<ObsigraphSettings> | null) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    for (const fn of this.styleListeners) fn();
  }

  onStylesChanged(fn: () => void): () => void {
    this.styleListeners.add(fn);
    return () => this.styleListeners.delete(fn);
  }

  openNote(path: string, sourcePath: string): void {
    void this.app.workspace.openLinkText(path, sourcePath, false);
  }
}
