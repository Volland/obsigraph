import { App, PluginSettingTab, Setting } from 'obsidian';
import type ObsigraphPlugin from './main';
import { parseTypeStyles, type TypeStyles } from './render/styles';

export interface ObsigraphSettings {
  /** Above this many nodes plus edges, graph results fall back to a table. */
  maxElements: number;
  /** Delay before visible blocks re-run after a vault change. */
  refreshDebounceMs: number;
  /** Per-type node styles keyed by type label. */
  typeStyles: TypeStyles;
}

export const DEFAULT_SETTINGS: ObsigraphSettings = {
  maxElements: 500,
  refreshDebounceMs: 300,
  typeStyles: {},
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

    const styles = new Setting(containerEl)
      .setName('Type styles')
      .setDesc('JSON keyed by type label, for example {"Person": {"color": "#59a14f", "shape": "round-rectangle"}}.');
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
  }
}
