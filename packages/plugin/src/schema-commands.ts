import { chooseTemplate, isSchemaPath, normalizeFolder, renderNoteFromType, scaffoldSchemaNote, splitFrontmatter, templatePath, type Diagnostic, type TypeSchema } from '@obsigraph/core';
import { exportShacl, importShacl, planImport, type ExistingNote, type ImportPlan, type ShaclImport } from '@obsigraph/core/src/shacl.js';
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
    private readonly initial = '',
    private readonly action = 'Create',
  ) {
    super(app);
    this.value = initial;
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
        t.setValue(this.initial).onChange((v) => (this.value = v));
        window.setTimeout(() => t.inputEl.focus(), 0);
      })
      .addButton((b) => b.setButtonText(this.action).setCta().onClick(submit));
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
    this.titleEl.setText(`Typed Graph diagnostics (${this.diagnostics.length})`);
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
      new PromptModal(app, 'New type name', (name) => void (async () => {
        const folder = normalizeFolder(plugin.settings.schemaFolder);
        if (!folder) {
          new Notice('Set a schema folder in the plugin settings first.');
          return;
        }
        if (!(await ensureFolder(app, folder))) return;
        await createNote(app, `${folder}${name}.md`, scaffoldSchemaNote(), name);
      })()).open();
    },
  });

  plugin.addCommand({
    id: 'export-schemas-shacl',
    name: 'Export schemas as SHACL',
    callback: () => new PromptModal(app, 'Write SHACL shapes to', (path) => void exportSchemas(plugin, path), 'shapes.ttl', 'Export').open(),
  });

  plugin.addCommand({
    id: 'import-shacl-shapes',
    name: 'Import SHACL shapes',
    callback: () =>
      new PromptModal(app, 'Import SHACL shapes from (Turtle file in the vault)', (path) => {
        new LayoutModal(app, (layout) => {
          if (layout !== 'single') void importShapes(plugin, path, layout);
          else new PromptModal(app, 'Note for all imported types', (into) => void importShapes(plugin, path, layout, into), 'Shapes', 'Import').open();
        }).open();
      }, 'shapes.ttl', 'Next').open(),
  });

  plugin.addCommand({
    id: 'show-diagnostics',
    name: 'Show diagnostics',
    callback: () => new DiagnosticsModal(app, plugin.index.diagnostics(), (p, line) => plugin.openNoteAt(p, line)).open(),
  });
}

type Layout = 'auto' | 'per-type' | 'single';

class LayoutModal extends SuggestModal<{ layout: Layout; label: string; hint: string }> {
  constructor(
    app: App,
    private readonly onPick: (layout: Layout) => void,
  ) {
    super(app);
    this.setPlaceholder('Where should imported types go?');
  }
  getSuggestions(): { layout: Layout; label: string; hint: string }[] {
    return [
      { layout: 'auto', label: 'As exported', hint: 'the notes recorded in the shapes, else one note per type' },
      { layout: 'per-type', label: 'One note per type', hint: 'Types/Person.md, Types/Company.md, ...' },
      { layout: 'single', label: 'A single note', hint: 'every type under schemas: in one note' },
    ];
  }
  renderSuggestion(o: { label: string; hint: string }, el: HTMLElement): void {
    el.createDiv({ text: o.label });
    el.createEl('small', { text: o.hint, cls: 'obsigraph-muted' });
  }
  onChooseSuggestion(o: { layout: Layout }): void {
    this.onPick(o.layout);
  }
}

/** Shows what an import changed and what it dropped. */
class ImportReportModal extends Modal {
  constructor(
    app: App,
    private readonly imp: ShaclImport,
    private readonly plan: ImportPlan,
  ) {
    super(app);
  }
  onOpen(): void {
    const { imp, plan } = this;
    this.titleEl.setText(`Imported ${imp.types.length} types and ${imp.edgeTypes.length} edge types`);
    const list = (heading: string, items: string[]) => {
      if (!items.length) return;
      this.contentEl.createEl('h4', { text: heading });
      const ul = this.contentEl.createEl('ul');
      for (const i of items) ul.createEl('li', { text: i });
    };
    list('Changed notes', plan.writes.map((w) => `${w.created ? 'Created' : 'Updated'} ${w.path}`));
    list('Unchanged', plan.unchanged);
    list('Not changed', plan.conflicts.map((c) => c.message.replace('--force', 'the CLI with --force')));
    list('Not kept by this layout', plan.warnings);
    list('Dropped (outside the TGS subset)', imp.dropped.map((d) => `${d.shape}: ${d.construct}`));
    if (!imp.dropped.length) this.contentEl.createDiv({ text: 'Everything in the file was imported.', cls: 'obsigraph-status' });
  }
  onClose(): void {
    this.contentEl.empty();
  }
}

/** Schema notes with their text and cached frontmatter. */
async function schemaNotes(plugin: ObsigraphPlugin): Promise<ExistingNote[]> {
  const { app } = plugin;
  const folder = normalizeFolder(plugin.settings.schemaFolder);
  const files = app.vault.getMarkdownFiles().filter((f) => isSchemaPath(f.path, folder));
  return Promise.all(files.map(async (f) => ({ path: f.path, text: await app.vault.cachedRead(f), frontmatter: app.metadataCache.getFileCache(f)?.frontmatter ?? null })));
}

// @lat: [[shacl#Commands]]
async function exportSchemas(plugin: ObsigraphPlugin, path: string): Promise<void> {
  const { app } = plugin;
  const set = plugin.index.schemas();
  const bodies = new Map((await schemaNotes(plugin)).map((n) => [n.path, splitFrontmatter(n.text).body]));
  const target = normalizePath(path);
  await app.vault.adapter.write(target, exportShacl(set, { base: plugin.settings.schemaBaseIri, body: (p) => bodies.get(p) ?? null }));
  new Notice(`Exported ${set.schemas.size} types and ${set.edgeTypes.size} edge types to ${target}.`);
}

// @lat: [[shacl#Commands]]
async function importShapes(plugin: ObsigraphPlugin, path: string, layout: Layout, into?: string): Promise<void> {
  const { app } = plugin;
  const source = normalizePath(path);
  if (!(await app.vault.adapter.exists(source))) {
    new Notice(`${source} does not exist.`);
    return;
  }
  let imp: ShaclImport;
  try {
    imp = importShacl(await app.vault.adapter.read(source), { base: plugin.settings.schemaBaseIri });
  } catch (e) {
    new Notice(`Cannot read ${source} as Turtle: ${(e as Error).message}`);
    return;
  }
  const folder = normalizeFolder(plugin.settings.schemaFolder);
  if (!folder) {
    new Notice('Set a schema folder in the plugin settings first.');
    return;
  }
  const plan = planImport(imp, await schemaNotes(plugin), { folder, layout, into });
  if (plan.writes.length && !(await ensureFolder(app, folder))) return;
  for (const w of plan.writes) {
    const file = app.vault.getAbstractFileByPath(w.path);
    if (file instanceof TFile) await app.vault.modify(file, w.text);
    else await app.vault.create(w.path, w.text);
  }
  new ImportReportModal(app, imp, plan).open();
}

/** Body of a markdown file without its frontmatter, or null when it does not exist. */
async function bodyOf(app: App, path: string | null): Promise<string | null> {
  const file = path ? app.vault.getAbstractFileByPath(path) : null;
  return file instanceof TFile ? splitFrontmatter(await app.vault.cachedRead(file)).body : null;
}

// @lat: [[graph-model#Schema notes]]
async function createFromType(plugin: ObsigraphPlugin, schema: TypeSchema, title: string): Promise<void> {
  const { app } = plugin;
  let linkedBody: string | null = null;
  if (schema.template) {
    const resolve = (link: string, from: string) => app.metadataCache.getFirstLinkpathDest(link, from)?.path ?? null;
    linkedBody = await bodyOf(app, templatePath(schema.template, schema.path, resolve));
    if (linkedBody === null) new Notice(`Template ${schema.template} for ${schema.type} was not found; using the next template source.`);
  }
  const { body, generated } = chooseTemplate(schema, { linkedBody, schemaBody: (await bodyOf(app, schema.path)) ?? '' });
  const parent = app.fileManager.getNewFileParent(app.workspace.getActiveFile()?.path ?? '');
  const dir = parent.isRoot() ? '' : `${parent.path}/`;
  await createNote(app, `${dir}${title}.md`, renderNoteFromType(schema, body, { placeholders: generated }), title);
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
