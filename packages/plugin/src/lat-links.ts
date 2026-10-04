import { checkLattice, type Diagnostic, type LatIndex } from '@obsigraph/core';

/** Where a lat.md link should go when clicked. */
export type LatLinkTarget = { kind: 'open'; path: string; line: number } | { kind: 'code'; file: string; symbol: string | null } | { kind: 'ambiguous'; candidates: string[] } | null;

/** True for a note inside a lat.md folder, at the vault root or below any folder. */
export function inLatFolder(path: string): boolean {
  return path.endsWith('.md') && /(^|\/)lat\.md\//.test(path);
}

/**
 * Decide what a clicked link means in a lat.md folder: a nested-heading or
 * short section id opens its file at the section's line; a source target is
 * reported rather than opened. Plain note links return null so Obsidian's own
 * handling stays in charge.
 */
// @lat: [[cli#Vault integration]]
export function latLinkTarget(index: LatIndex, href: string): LatLinkTarget {
  if (!href.includes('#')) return null;
  const r = index.resolve(href.trim());
  if (r.kind === 'section') return { kind: 'open', path: r.section.filePath, line: Math.max(0, r.section.startLine - 1) };
  if (r.kind === 'code') return { kind: 'code', file: r.file, symbol: r.symbol };
  if (r.kind === 'ambiguous') return { kind: 'ambiguous', candidates: r.candidates };
  return null;
}

/** Link and leading-paragraph findings of the lat.md folder as plugin diagnostics (index files and source checks need a project on disk, so they are left to the CLI). */
export function latDiagnostics(index: LatIndex): Diagnostic[] {
  if (index.sections().length === 0) return [];
  return checkLattice(
    { index, annotations: [], latEntries: [], latDirName: 'lat.md', readLatFile: () => null, checkSourceLink: () => null },
    ['md', 'sections'],
  ).map((f) => ({ path: f.file, line: Math.max(0, f.line - 1), column: 0, message: f.message.split('\n')[0]! }));
}
