import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const MARKERS = ['lat.md', '.tg'];

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Nearest ancestor of `start` (inclusive) holding `lat.md/` or `.tg/`, or null. */
export function findRoot(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    if (MARKERS.some((m) => isDir(join(dir, m)))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

export function hasProject(dir: string): boolean {
  return existsSync(dir) && MARKERS.some((m) => isDir(join(dir, m)));
}
