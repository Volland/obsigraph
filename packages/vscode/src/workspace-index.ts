import { readFile, stat } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { buildCodeLayer, Graph, langOfFile, pathResolver, scanAnnotations, splitTarget, upsertCodeNode, type Annotation } from '@obsigraph/core';
import { listFiles, listMarkdown, readNote } from '@obsigraph/node-vault';

const MAX_SOURCE_BYTES = 1_500_000;

export interface IndexOptions {
  /** Absolute path of the workspace folder; node ids are paths relative to it. */
  workspace: string;
  /** Folders relative to the workspace folder; `.` or empty means the whole folder. */
  roots: string[];
  /** Folder names skipped at any depth, in addition to dot folders. */
  ignore: string[];
}

const clean = (p: string): string => posix.normalize(p.replace(/\\/g, '/')).replace(/^\.\/?/, '').replace(/\/+$/, '');

/**
 * The typed graph of a workspace: markdown notes plus the derived code layer
 * from annotated source files, kept current per file. Read-only: nothing is
 * ever written into the indexed folders.
 */
// @lat: [[vscode#Workspace index]]
// @tg: implements:: [[openspec:vscode-extension#Index the workspace in process]]
export class WorkspaceIndex {
  readonly graph: Graph;
  private readonly notes = new Set<string>();
  private readonly sources = new Map<string, string>();
  private readonly annotations = new Map<string, Annotation[]>();
  private inserted = new Set<string>();
  private readonly roots: string[];

  constructor(private readonly opts: IndexOptions) {
    this.roots = [...new Set((opts.roots.length ? opts.roots : ['.']).map(clean))];
    this.graph = new Graph(pathResolver(() => this.notes), (link, sub) => (this.inserted.has(`${link}#${sub}`) ? `${link}#${sub}` : null));
  }

  /** True when a workspace-relative path lies under a root and outside dot and ignored folders. */
  // @tg: implements:: [[openspec:vscode-extension#Configurable roots]]
  accepts(path: string): boolean {
    const p = clean(path);
    const inRoot = this.roots.some((r) => r === '' || p === r || p.startsWith(`${r}/`));
    return inRoot && !p.split('/').some((seg) => seg.startsWith('.') || this.opts.ignore.includes(seg));
  }

  // @tg: implements:: [[openspec:vscode-extension#Configurable roots]]
  async load(): Promise<void> {
    const seenMd = new Set<string>();
    const seenSrc = new Set<string>();
    for (const root of this.roots) {
      const dir = join(this.opts.workspace, root);
      const prefix = root === '' ? '' : `${root}/`;
      for (const f of await listMarkdown(dir, { ignore: this.opts.ignore }).catch(() => [])) seenMd.add(prefix + f.path);
      const src = await listFiles(dir, { ignore: this.opts.ignore, accept: (n) => langOfFile(n) !== null, maxBytes: MAX_SOURCE_BYTES }).catch(() => []);
      for (const f of src) seenSrc.add(prefix + f.path);
    }
    for (const path of seenMd) this.notes.add(path);
    for (const path of seenMd) await this.readMarkdown(path);
    for (const path of seenSrc) await this.readSource(path, false);
    this.rebuildCode();
  }

  /** A file changed or was created; removes it when it no longer exists. */
  async update(path: string): Promise<void> {
    const p = clean(path);
    if (!this.accepts(p)) return;
    const exists = await stat(join(this.opts.workspace, p)).then((s) => s.isFile(), () => false);
    if (!exists) return this.remove(p);
    if (p.toLowerCase().endsWith('.md')) {
      this.notes.add(p);
      await this.readMarkdown(p);
    } else if (langOfFile(p)) {
      await this.readSource(p, true);
    }
  }

  remove(path: string): void {
    const p = clean(path);
    if (this.notes.delete(p)) this.graph.removeNote(p);
    else if (this.sources.delete(p)) {
      this.annotations.delete(p);
      this.rebuildCode();
    }
  }

  /** Annotations written in one source file. */
  annotationsIn(path: string): Annotation[] {
    return this.annotations.get(path) ?? [];
  }

  /** Every annotation edge whose link resolves to the given note, with where it was written. */
  // @tg: implements:: [[openspec:vscode-extension#Backlinks for source files]]
  annotationsTargeting(notePath: string): { file: string; line: number; target: string }[] {
    const out: { file: string; line: number; target: string }[] = [];
    for (const [file, list] of this.annotations) {
      for (const a of list) {
        for (const e of a.edges) {
          if (this.graph.resolveLink(splitTarget(e.target).file, file) === notePath) out.push({ file, line: a.line, target: e.target });
        }
      }
    }
    return out;
  }

  isNote(path: string): boolean {
    return this.notes.has(path);
  }

  isSource(path: string): boolean {
    return this.sources.has(path);
  }

  private async readMarkdown(path: string): Promise<void> {
    try {
      this.graph.upsertNote((await readNote(this.opts.workspace, path)).note);
    } catch {
      this.notes.delete(path);
      this.graph.removeNote(path);
    }
  }

  private async readSource(path: string, rebuild: boolean): Promise<void> {
    try {
      const text = await readFile(join(this.opts.workspace, path), 'utf8');
      this.sources.set(path, text);
      this.annotations.set(path, scanAnnotations(path, text).annotations);
      if (rebuild) this.rebuildCode();
    } catch {
      this.sources.delete(path);
      this.annotations.delete(path);
    }
  }

  /** Recompute the derived code nodes from the cached source texts and sync the graph with them. */
  private rebuildCode(): void {
    const layer = buildCodeLayer([...this.sources].map(([path, text]) => ({ path, text })), 'annotated', (target, source) => this.graph.resolveLink(splitTarget(target).file, source));
    const next = new Set(layer.nodes.map((n) => n.path));
    for (const path of this.inserted) if (!next.has(path)) this.graph.removeNote(path);
    this.inserted = next;
    for (const n of layer.nodes) upsertCodeNode(this.graph, n);
  }
}
