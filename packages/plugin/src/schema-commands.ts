import { normalizeFolder, renderNoteFromType, scaffoldSchemaNote, splitFrontmatter, type Diagnostic, type TypeSchema } from '@obsigraph/core';
import { App, Modal, Notice, normalizePath, Setting, SuggestModal, TFile } from 'obsidian';
import type ObsigraphPlugin from './main';

const BAD_NAME = /[\\/:*?"<>|#^[\]]/;

/** Ask for a single line of text. */
class PromptModal extends Modal {
  private value = '';

  constructor(
    app: App,
    private readonly title: string,
    private readonly onSubmit: (value: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.title);
    const submit = () => {
      const v = this.value.trim();
      if (!v) return;
      this.close();
      this.onSubmit(v);
    };
    new Setting(this.contentEl)
      .addText((t) => {
        t.inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') submit();
        });
        t.onChange((v) => (this.value = v));
        window.setTimeout(() => t.inputEl.focus(), 0);
      })
      .addButton((b) => b.setButtonText('Create').setCta().onClick(submit));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class TypeSuggestModal extends SuggestModal<TypeSchema> {
  constructor(
    app: App,
    private readonly types: TypeSchema[],
    private readonly onPick: (t: TypeSchema) => void,
  ) {
    super(app);
    this.setPlaceholder('Choose a type');
  }
  getSuggestions(query: string): TypeSchema[] {
    const q = query.toLowerCase();
    return this.types.filter((t) => t.type.toLowerCase().includes(q));
  }
  renderSuggestion(t: TypeSchema, el: HTMLElement): void {
    el.createDiv({ text: t.type });
    el.createEl('small', { text: t.properties.map((p) => p.name).join(', ') || 'no declared properties', cls: 'obsigraph-muted' });
  }
  onChooseSuggestion(t: TypeSchema): void {
    this.onPick(t);
  }
}

/** Lists graph diagnostics grouped by note; clicking one opens the note at its line. */
export class DiagnosticsModal extends Modal {
  constructor(
    app: App,
    private readonly diagnostics: Diagnostic[],
    private readonly openAt: (path: string, line: number) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(`Obsigraph diagnostics (${this.diagnostics.length})`);
    if (this.diagnostics.length === 0) {
      this.contentEl.createDiv({ text: 'No issues found.', cls: 'obsigraph-status' });
      return;
    }
    const byPath = new Map<string, Diagnostic[]>();
    for (const d of this.diagnostics) {
      const k = d.path ?? '(unknown)';
      byPath.set(k, [...(byPath.get(k) ?? []), d]);
    }
    for (const [path, list] of [...byPath].sort(([a], [b]) => a.localeCompare(b))) {
      this.contentEl.createEl('h4', { text: path });
      const ul = this.contentEl.createEl('ul', { cls: 'obsigraph-diagnostics' });
      for (const d of list.sort((a, b) => a.line - b.line)) {
        const li = ul.createEl('li');
        const a = li.createEl('a', { text: `Line ${d.line + 1}: ${d.message}`, href: '#' });
        a.addEventListener('click', (e) => {
          e.preventDefault();
          this.close();
          this.openAt(path, d.line);
        });
      }
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// @lat: [[graph-model#Schema notes]]
export function registerSchemaCommands(plugin: ObsigraphPlugin): void {
  const { app } = plugin;

  plugin.addCommand({
    id: 'create-note-from-type',
    name: 'Create note from type',
    callback: () => {
      const types = [...plugin.index.schemas().schemas.values()].sort((a, b) => a.type.localeCompare(b.type));
      if (types.length === 0) {
        new Notice(`No schema notes found in ${normalizeFolder(plugin.settings.schemaFolder) || 'the schema folder'}.`);
        return;
      }
      new TypeSuggestModal(app, types, (schema) => {
        new PromptModal(app, `New ${schema.type}`, (title) => void createFromType(plugin, schema, title)).open();
      }).open();
    },
  });

  plugin.addCommand({
    id: 'create-schema-note',
    name: 'Create schema note',
    callback: () => {
      new PromptModal(app, 'New type name', async (name) => {
        const folder = normalizeFolder(plugin.settings.schemaFolder);
        if (!folder) {
          new Notice('Set a schema folder in Obsigraph settings first.');
          return;
        }
        if (!(await ensureFolder(app, folder))) return;
        await createNote(app, `${folder}${name}.md`, scaffoldSchemaNote(), name);
      }).open();
    },
  });

  plugin.addCommand({
    id: 'show-diagnostics',
    name: 'Show diagnostics',
    callback: () => new DiagnosticsModal(app, plugin.index.diagnostics(), (p, line) => plugin.openNoteAt(p, line)).open(),
  });
}

async function createFromType(plugin: ObsigraphPlugin, schema: TypeSchema, title: string): Promise<void> {
  const { app } = plugin;
  const schemaFile = app.vault.getAbstractFileByPath(schema.path);
  const body = schemaFile instanceof TFile ? splitFrontmatter(await app.vault.cachedRead(schemaFile)).body : '';
  const parent = app.fileManager.getNewFileParent(app.workspace.getActiveFile()?.path ?? '');
  const dir = parent.isRoot() ? '' : `${parent.path}/`;
  await createNote(app, `${dir}${title}.md`, renderNoteFromType(schema, body), title);
}

/** Create a note, refusing to overwrite an existing one. */
async function createNote(app: App, path: string, content: string, name: string): Promise<void> {
  if (BAD_NAME.test(name)) {
    new Notice(`"${name}" contains characters that are not allowed in note names.`);
    return;
  }
  const target = normalizePath(path);
  if (app.vault.getAbstractFileByPath(target)) {
    new Notice(`${target} already exists; nothing was changed.`);
    return;
  }
  const file = await app.vault.create(target, content);
  await app.workspace.getLeaf(false).openFile(file);
}

async function ensureFolder(app: App, folder: string): Promise<boolean> {
  const path = normalizePath(folder);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) {
    if (existing instanceof TFile) {
      new Notice(`${path} is a file, not a folder.`);
      return false;
    }
    return true;
  }
  await app.vault.createFolder(path);
  return true;
}
