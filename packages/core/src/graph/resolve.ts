import type { LinkResolver } from './graph.js';

/**
 * Obsidian-like link resolution over a set of note paths, for hosts without
 * Obsidian (the sidecar): an exact path wins; otherwise a note whose path ends
 * with the link, preferring the source note's folder, then the shortest path.
 */
// @lat: [[sidecar#Shared core]]
export function pathResolver(paths: () => Iterable<string>): LinkResolver {
  return (link, sourcePath) => {
    const target = link.trim().replace(/^\/+/, '');
    if (!target) return null;
    const withExt = target.toLowerCase().endsWith('.md') ? target : `${target}.md`;
    const all = [...paths()];
    if (all.includes(withExt)) return withExt;
    const lower = withExt.toLowerCase();
    const matches = all.filter((p) => {
      const lp = p.toLowerCase();
      return lp === lower || lp.endsWith(`/${lower}`);
    });
    if (matches.length === 0) return null;
    const folder = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1) : '';
    const local = matches.find((p) => p === `${folder}${withExt}` || p.toLowerCase() === `${folder}${withExt}`.toLowerCase());
    if (local) return local;
    return matches.sort((a, b) => a.length - b.length || a.localeCompare(b))[0]!;
  };
}
