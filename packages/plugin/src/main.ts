import { Plugin } from 'obsidian';
import { QueryBlock } from './query/query-block';
import { DEFAULT_SETTINGS, ObsigraphSettingTab, type ObsigraphSettings } from './settings';
import { VaultIndex } from './vault-index';
import { GraphView, VIEW_TYPE_GRAPH } from './view/graph-view';
import { DiagnosticsModal, registerSchemaCommands } from './schema-commands';

// @lat: [[architecture#Standalone plugin]]
export default class ObsigraphPlugin extends Plugin {
  settings: ObsigraphSettings = DEFAULT_SETTINGS;
  index!: VaultIndex;
  private readonly styleListeners = new Set<() => void>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.index = new VaultIndex(this.app, () => this.settings.refreshDebounceMs, () => this.settings.schemaFolder);
    this.addSettingTab(new ObsigraphSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor('graph-query', (source, el, ctx) => {
      ctx.addChild(new QueryBlock(el, source, ctx.sourcePath, this));
    });

    this.registerView(VIEW_TYPE_GRAPH, (leaf) => new GraphView(leaf, this));
    this.addCommand({ id: 'open-graph-view', name: 'Open graph view', callback: () => this.openGraphView() });
    this.addRibbonIcon('git-fork', 'Open Obsigraph view', () => this.openGraphView());
    registerSchemaCommands(this);

    this.app.workspace.onLayoutReady(async () => {
      for (const ref of this.index.watch()) this.registerEvent(ref);
      const status = this.addStatusBarItem();
      status.addClass('mod-clickable');
      status.addEventListener('click', () =>
        new DiagnosticsModal(this.app, this.index.diagnostics(), (p, line) => this.openNoteAt(p, line)).open(),
      );
      const update = () => {
        const { nodes, edges } = this.index.graph.size;
        const issues = this.settings.showDiagnostics ? this.index.diagnostics().length : 0;
        status.setText(`Obsigraph: ${nodes} nodes, ${edges} edges${issues ? ` · ${issues} issues` : ''}`);
      };
      this.register(this.index.onChange(update));
      this.register(this.onStylesChanged(update));
      await this.index.build((done, total) => status.setText(`Obsigraph: indexing ${done}/${total}`));
      update();
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

  async openGraphView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_GRAPH)[0];
    const leaf = existing ?? this.app.workspace.getLeaf('tab');
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE_GRAPH, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  openNoteAt(path: string, line: number): void {
    void this.app.workspace.openLinkText(path, '', false, { eState: { line } });
  }

  openNote(path: string, sourcePath: string): void {
    void this.app.workspace.openLinkText(path, sourcePath, false);
  }
}
