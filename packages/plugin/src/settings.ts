import { App, PluginSettingTab, Setting } from 'obsidian';
import type ObsigraphPlugin from './main';
import { DEFAULT_MAX_PATH_DEPTH, DEFAULT_SCHEMA_FOLDER, type EdgeStyle, type NodeStyle } from '@obsigraph/core';
import { parseEdgeStyles, parseTypeStyles } from './render/styles';

export interface ObsigraphSettings {
  /** Above this many nodes plus edges, graph results fall back to a table. */
  maxElements: number;
  /** Delay before visible blocks re-run after a vault change. */
  refreshDebounceMs: number;
  /** Per-type node styles keyed by type label (third in style precedence). */
  typeStyles: Record<string, NodeStyle>;
  /** Per-edge-type styles keyed by edge type (third in style precedence). */
  edgeStyles: Record<string, EdgeStyle>;
  /** Folder whose notes declare type schemas. */
  schemaFolder: string;
  /** Show the diagnostics count in the status bar. */
  showDiagnostics: boolean;
  /** Depth cap for unbounded variable-length relationships. */
  maxPathDepth: number;
  /** Engine for blocks without a `backend` option. */
  defaultBackend: 'builtin' | 'ladybug';
  /** Typed Graph sidecar base URL, e.g. http://127.0.0.1:8765. */
  sidecarUrl: string;
  sidecarToken: string;
}

export const DEFAULT_SETTINGS: ObsigraphSettings = {
  maxElements: 500,
  refreshDebounceMs: 300,
  typeStyles: {},
  edgeStyles: {},
  schemaFolder: DEFAULT_SCHEMA_FOLDER,
  showDiagnostics: true,
  maxPathDepth: DEFAULT_MAX_PATH_DEPTH,
  defaultBackend: 'builtin',
  sidecarUrl: '',
  sidecarToken: '',
};

export class ObsigraphSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: ObsigraphPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Maximum graph elements')
      .setDesc('Graph results with more nodes plus edges than this are shown as a table instead.')
      .addText((t) =>
        t.setValue(String(this.plugin.settings.maxElements)).onChange(async (v) => {
          const n = Number(v);
          if (Number.isInteger(n) && n > 0) {
            this.plugin.settings.maxElements = n;
            await this.plugin.saveSettings();
          }
        }),
      );

    new Setting(containerEl)
      .setName('Default query backend')
      .setDesc('Where blocks run unless they set a backend line. Built-in runs inside the app; the sidecar option runs full read queries on its graph database.')
      .addDropdown((d) =>
        d
          .addOptions({ builtin: 'Built-in', ladybug: 'Ladybug (sidecar)' })
          .setValue(this.plugin.settings.defaultBackend)
          .onChange(async (v) => {
            this.plugin.settings.defaultBackend = v === 'ladybug' ? 'ladybug' : 'builtin';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Sidecar URL')
      .setDesc('Address and port of the sidecar, used by sidecar-backed queries.')
      .addText((t) =>
        t.setValue(this.plugin.settings.sidecarUrl).onChange(async (v) => {
          this.plugin.settings.sidecarUrl = v.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Sidecar token')
      .setDesc('Bearer token configured on the sidecar. Stored in this vault\'s plugin data.')
      .addText((t) => {
        t.inputEl.type = 'password';
        t.setValue(this.plugin.settings.sidecarToken).onChange(async (v) => {
          this.plugin.settings.sidecarToken = v.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Maximum path depth')
      .setDesc('Unbounded variable-length patterns such as [:knows*] stop at this many hops.')
      .addText((t) =>
        t.setValue(String(this.plugin.settings.maxPathDepth)).onChange(async (v) => {
          const n = Number(v);
          if (Number.isInteger(n) && n > 0 && n <= 50) {
            this.plugin.settings.maxPathDepth = n;
            await this.plugin.saveSettings();
          }
        }),
      );

    new Setting(containerEl)
      .setName('Refresh delay (ms)')
      .setDesc('How long query blocks wait after a vault change before re-running.')
      .addText((t) =>
        t.setValue(String(this.plugin.settings.refreshDebounceMs)).onChange(async (v) => {
          const n = Number(v);
          if (Number.isInteger(n) && n >= 0) {
            this.plugin.settings.refreshDebounceMs = n;
            await this.plugin.saveSettings();
          }
        }),
      );

    new Setting(containerEl)
      .setName('Schema folder')
      .setDesc('Each note directly in this folder declares the schema for the type named by its title.')
      .addText((t) =>
        t.setPlaceholder(DEFAULT_SCHEMA_FOLDER).setValue(this.plugin.settings.schemaFolder).onChange(async (v) => {
          this.plugin.settings.schemaFolder = v.trim() || DEFAULT_SCHEMA_FOLDER;
          this.plugin.index.invalidate();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Show diagnostics')
      .setDesc('Show the number of parse and schema issues in the status bar.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showDiagnostics).onChange(async (v) => {
          this.plugin.settings.showDiagnostics = v;
          await this.plugin.saveSettings();
        }),
      );

    const styles = new Setting(containerEl)
      .setName('Type styles')
      .setDesc('JSON keyed by type label: color, shape, icon (Lucide name) and label (property shown instead of the title). Schema notes and block headers override these per attribute. Example: {"Person": {"color": "#59a14f", "shape": "round-rectangle", "icon": "user"}}.');
    const status = containerEl.createDiv({ cls: 'obsigraph-setting-status' });
    styles.addTextArea((t) => {
      t.inputEl.rows = 8;
      t.inputEl.addClass('obsigraph-styles-input');
      t.setValue(JSON.stringify(this.plugin.settings.typeStyles, null, 2)).onChange(async (v) => {
        const parsed = parseTypeStyles(v);
        if (typeof parsed === 'string') {
          status.setText(parsed);
          return;
        }
        status.setText('');
        this.plugin.settings.typeStyles = parsed;
        await this.plugin.saveSettings();
      });
    });

    const edgeStyles = new Setting(containerEl)
      .setName('Edge styles')
      .setDesc('JSON keyed by edge type: color and line (solid, dashed, dotted). Negative edges are dashed red unless set here. Example: {"knows": {"color": "orange"}}.');
    const edgeStatus = containerEl.createDiv({ cls: 'obsigraph-setting-status' });
    edgeStyles.addTextArea((t) => {
      t.inputEl.rows = 6;
      t.inputEl.addClass('obsigraph-styles-input');
      t.setValue(JSON.stringify(this.plugin.settings.edgeStyles, null, 2)).onChange(async (v) => {
        const parsed = parseEdgeStyles(v);
        if (typeof parsed === 'string') {
          edgeStatus.setText(parsed);
          return;
        }
        edgeStatus.setText('');
        this.plugin.settings.edgeStyles = parsed;
        await this.plugin.saveSettings();
      });
    });
  }
}
