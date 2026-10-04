import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LatIndex, lookupSymbol, scanAnnotations, type Annotation, type Diagnostic } from '@obsigraph/core';
import { walkProject } from './walk.mjs';

const MAX_SOURCE_BYTES = 1_500_000;

export class NoLatDir extends Error {
  constructor(root: string) {
    super(`${join(root, 'lat.md')} does not exist; run tg init`);
  }
}

/** A project on disk: the lattice (`lat.md/`), the source files around it, and lazily scanned annotations. */
export class Project {
  readonly latDir: string;
  private textCache = new Map<string, string | null>();
  private latEntriesCache: string[] | null = null;
  private indexCache: LatIndex | null = null;
  private sourceCache: string[] | null = null;
  private annCache: { annotations: Annotation[]; diagnostics: Diagnostic[] } | null = null;

  constructor(readonly root: string) {
    this.latDir = join(root, 'lat.md');
    if (!existsSync(this.latDir) || !statSync(this.latDir).isDirectory()) throw new NoLatDir(root);
  }

  /** Read a project-relative file; null when unreadable. */
  text(rel: string): string | null {
    if (!this.textCache.has(rel)) {
      let t: string | null = null;
      try {
        t = readFileSync(join(this.root, rel), 'utf8');
      } catch {
        t = null;
      }
      this.textCache.set(rel, t);
    }
    return this.textCache.get(rel) ?? null;
  }

  /** Files under lat.md/, relative to it, sorted. */
  latEntries(): string[] {
    return (this.latEntriesCache ??= walkProject(this.latDir).sort());
  }

  mdFiles(): string[] {
    return this.latEntries().filter((e) => e.endsWith('.md')).map((e) => `lat.md/${e}`);
  }

  index(): LatIndex {
    if (!this.indexCache) {
      this.indexCache = new LatIndex(this.mdFiles().map((path) => ({ path, text: this.text(path) ?? '' })));
    }
    return this.indexCache;
  }

  /** Source files outside lat.md/: no markdown, no `.claude/`, no nested projects that have their own lat.md. */
  sourceFiles(): string[] {
    if (!this.sourceCache) {
      const all = walkProject(this.root);
      const nested = new Set<string>();
      for (const e of all) {
        const i = e.indexOf('/lat.md/');
        if (i !== -1) nested.add(e.slice(0, i + 1));
      }
      this.sourceCache = all.filter((e) => !e.endsWith('.md') && !e.startsWith('lat.md/') && !e.startsWith('.claude/') && ![...nested].some((p) => e.startsWith(p)));
    }
    return this.sourceCache;
  }

  annotations(): { annotations: Annotation[]; diagnostics: Diagnostic[] } {
    if (!this.annCache) {
      const annotations: Annotation[] = [];
      const diagnostics: Diagnostic[] = [];
      for (const f of this.sourceFiles()) {
        let size = 0;
        try {
          size = statSync(join(this.root, f)).size;
        } catch {
          continue;
        }
        if (size > MAX_SOURCE_BYTES) continue;
        const t = this.text(f);
        if (t === null || t.includes('\0')) continue;
        const r = scanAnnotations(f, t);
        annotations.push(...r.annotations);
        diagnostics.push(...r.diagnostics);
      }
      this.annCache = { annotations, diagnostics };
    }
    return this.annCache;
  }

  /** Error text for a source link whose file or symbol does not exist; null when fine or not judgeable. */
  checkSourceLink(file: string, symbol: string | null): string | null {
    if (!existsSync(join(this.root, file))) return `file "${file}" not found`;
    if (!symbol) return null;
    const r = lookupSymbol(file, this.text(file), symbol);
    return r.status === 'absent' ? `symbol "${symbol}" not found in "${file}"` : null;
  }
}

/** File counts by extension, for the "Scanned" line. */
export function countByExt(paths: string[]): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const p of paths) {
    const base = p.slice(p.lastIndexOf('/') + 1);
    const i = base.lastIndexOf('.');
    const ext = i <= 0 ? '(no ext)' : base.slice(i);
    stats[ext] = (stats[ext] ?? 0) + 1;
  }
  return stats;
}
