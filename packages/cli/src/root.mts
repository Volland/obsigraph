import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Folders that hold a project's docs, in order of preference: an existing `lat.md/` always wins, for lat.md compatibility. */
export const DOCS_DIRS = ['lat.md', 'tg.md'] as const;
export type DocsDir = (typeof DOCS_DIRS)[number];

const MARKERS = [...DOCS_DIRS, '.tg'];

/**
 * A docs folder candidate: a directory named `lat.md` or `tg.md` that is not
 * itself a git repository. A clone of the lat.md tool's own repository is
 * called `lat.md/` too, and must not turn its parent folder into a project.
 */
function isDocsDir(p: string): boolean {
  return isDir(p) && !existsSync(join(p, '.git'));
}

function isMarker(dir: string, m: string): boolean {
  return m === '.tg' ? isDir(join(dir, m)) : isDocsDir(join(dir, m));
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Nearest ancestor of `start` (inclusive) holding `lat.md/`, `tg.md/` or `.tg/`, or null. */
// @tg: implements:: [[openspec:tg-cli#Project root discovery]]
export function findRoot(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    if (MARKERS.some((m) => isMarker(dir, m))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

// @tg: implements:: [[openspec:tg-cli#Project root discovery]]
export function hasProject(dir: string): boolean {
  return existsSync(dir) && MARKERS.some((m) => isMarker(dir, m));
}

/** The docs folder `root` uses: `lat.md` when it exists, else `tg.md` when that exists, else null. */
// @tg: implements:: [[openspec:tg-cli#Docs folder]]
export function existingDocsDir(root: string): DocsDir | null {
  return DOCS_DIRS.find((d) => isDocsDir(join(root, d))) ?? null;
}
