import { markdownTarget } from '../edges/parse.js';
import { mapProse, outsideCode } from '../latmd/export.js';
import { splitFrontmatter } from '../schema/frontmatter.js';
import type { OkfNote } from './export.js';

export type OkfFindingKind =
  | 'missing-frontmatter'
  | 'invalid-frontmatter'
  | 'missing-type'
  | 'type-not-string'
  | 'index-frontmatter'
  | 'log-date'
  | 'broken-link'
  | 'wikilink'
  | 'missing-description'
  | 'legacy-timestamp';

export interface OkfFinding {
  /** Bundle-relative path. */
  file: string;
  /** 1-based; 1 for frontmatter-level findings. */
  line: number;
  kind: OkfFindingKind;
  /** Errors break conformance (OKF section 11); warnings are soft guidance. */
  severity: 'error' | 'warning';
  message: string;
}

const MD_LINK = /(!?)\[(?:[^[\]\n]|\[[^\]\n]*\])*\]\(\s*(<[^>\n]*>|[^)\s]*)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
const WIKI = /(?<!!)\[\[[^\]\n]+\]\]/g;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const baseName = (p: string): string => p.slice(p.lastIndexOf('/') + 1).toLowerCase();

/**
 * Check a folder against OKF v0.2 conformance: every concept has parseable
 * frontmatter with a non-empty string `type`, index files carry no frontmatter
 * (except `okf_version` at the root) and log date headings are `YYYY-MM-DD`.
 * Broken links, wikilinks, missing descriptions and the v0.1 `timestamp` key
 * are warnings, because consumers must tolerate them.
 */
// @lat: [[okf#Conformance check]]
export function checkOkf(files: OkfNote[]): OkfFinding[] {
  const out: OkfFinding[] = [];
  const known = new Set(files.map((f) => f.path.toLowerCase()));
  const push = (file: string, line: number, kind: OkfFindingKind, severity: OkfFinding['severity'], message: string) => out.push({ file, line, kind, severity, message });

  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const base = baseName(f.path);
    const { yaml } = splitFrontmatter(f.text);
    if (base === 'index.md') {
      const keys = Object.keys(f.frontmatter ?? {});
      if (yaml !== null && f.path.includes('/')) push(f.path, 1, 'index-frontmatter', 'error', 'index.md below the bundle root must not have frontmatter');
      else if (yaml !== null && keys.some((k) => k !== 'okf_version')) push(f.path, 1, 'index-frontmatter', 'error', `the root index.md may only declare okf_version in frontmatter, found: ${keys.filter((k) => k !== 'okf_version').join(', ')}`);
    } else if (base === 'log.md') {
      mapProse(f.text, (line, n) => {
        const h = /^##\s+(.*?)\s*#*\s*$/.exec(line);
        if (h && !ISO_DATE.test(h[1]!)) push(f.path, n, 'log-date', 'error', `log date heading "${h[1]}" must be YYYY-MM-DD`);
        return line;
      });
    } else if (yaml === null) {
      push(f.path, 1, 'missing-frontmatter', 'error', 'concept has no YAML frontmatter block');
      continue;
    } else if (f.frontmatterError) {
      push(f.path, 1, 'invalid-frontmatter', 'error', `frontmatter is not valid YAML: ${f.frontmatterError}`);
      continue;
    } else {
      const t = f.frontmatter?.type;
      if (Array.isArray(t)) push(f.path, 1, 'type-not-string', 'error', 'type must be a single string, not a list');
      else if (typeof t !== 'string' || t.trim() === '') push(f.path, 1, 'missing-type', 'error', 'frontmatter has no non-empty type');
      const d = f.frontmatter?.description;
      if (typeof d !== 'string' || d.trim() === '') push(f.path, 1, 'missing-description', 'warning', 'no description; index files and search snippets use it');
      if (f.frontmatter && 'timestamp' in f.frontmatter && !('generated' in f.frontmatter)) push(f.path, 1, 'legacy-timestamp', 'warning', 'timestamp is OKF v0.1; v0.2 records it as generated: { by, at }');
    }

    mapProse(f.text, (line, n) => {
      outsideCode(line, (part) => {
        for (const m of part.matchAll(MD_LINK)) {
          if (m[1]) continue;
          const t = markdownTarget(m[2]!, f.path);
          if (t && !known.has(t.target.toLowerCase())) push(f.path, n, 'broken-link', 'warning', `link to ${t.target} does not resolve in the bundle`);
        }
        for (const m of part.matchAll(WIKI)) push(f.path, n, 'wikilink', 'warning', `${m[0]} is not a markdown link; OKF consumers will not follow it`);
        return part;
      });
      return line;
    });
  }
  return out;
}
