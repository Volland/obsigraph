import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { compileIgnore, type IgnoreRules } from '@obsigraph/core';

const ALWAYS_SKIP = new Set(['.git', 'node_modules']);

interface Scope {
  base: string;
  rules: IgnoreRules;
}

function ignored(rel: string, isDir: boolean, scopes: Scope[]): boolean {
  let result = false;
  for (const s of scopes) {
    const sub = s.base ? rel.slice(s.base.length + 1) : rel;
    const r = s.rules.test(sub, isDir);
    if (r !== null) result = r;
  }
  return result;
}

/**
 * Every file under `root` as a project-relative posix path, honoring nested
 * `.gitignore` files; skips `.git`, `node_modules` and top-level dot entries,
 * as lat.md's walker does for dotfiles.
 */
// @tg: implements:: [[openspec:symbol-provider#Source walker]]
export function walkProject(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string, rel: string, scopes: Scope[]): void => {
    let local = scopes;
    try {
      local = [...scopes, { base: rel, rules: compileIgnore(readFileSync(join(dir, '.gitignore'), 'utf8')) }];
    } catch {
      // no .gitignore here
    }
    let names: string[];
    try {
      names = readdirSync(dir).sort();
    } catch {
      return;
    }
    for (const name of names) {
      if (ALWAYS_SKIP.has(name) || (rel === '' && name.startsWith('.'))) continue;
      const childRel = rel ? `${rel}/${name}` : name;
      let isDir: boolean;
      try {
        isDir = statSync(join(dir, name)).isDirectory();
      } catch {
        continue;
      }
      if (ignored(childRel, isDir, local)) continue;
      if (isDir) visit(join(dir, name), childRel, local);
      else out.push(childRel);
    }
  };
  visit(root, '', []);
  return out;
}
