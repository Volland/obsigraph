import { Graph } from '../graph/graph.js';
import { pathResolver } from '../graph/resolve.js';
import { expandEmbeds, mapProse, outsideCode, Report } from '../latmd/export.js';
import { splitFrontmatter, toYaml } from '../schema/frontmatter.js';

/** OKF version the export targets and declares in the root `index.md`. */
export const OKF_VERSION = '0.2';

export interface OkfNote {
  /** Vault-relative posix path ending in `.md`. */
  path: string;
  text: string;
  /** Parsed YAML frontmatter, or null when there is none or it is empty. */
  frontmatter: Record<string, unknown> | null;
  /** Parse error of the frontmatter, when it is not valid YAML. */
  frontmatterError?: string | null;
}

export interface OkfExportOptions {
  /** `type` for notes without one. */
  defaultType?: string;
  /** Heading of the root `index.md`. */
  title?: string;
  /** Vault-relative paths of non-note files, so attachment embeds can be resolved and copied. */
  attachments?: string[];
}

export interface OkfFile {
  /** Bundle-relative posix path. */
  path: string;
  text: string;
}

export type OkfChangeKind =
  | 'default-type'
  | 'multi-type'
  | 'added-title'
  | 'added-description'
  | 'wikilink'
  | 'broken-link'
  | 'transclusion'
  | 'attachment'
  | 'edge-embed'
  | 'renamed-reserved'
  | 'generated-index'
  | 'invalid-frontmatter';

export interface OkfChange {
  kind: OkfChangeKind;
  count: number;
  /** Up to three `path:line` places, for the report. */
  examples: string[];
}

export interface OkfExportResult {
  files: OkfFile[];
  /** Vault-relative attachment paths to copy unchanged to the same place in the bundle. */
  attachments: string[];
  report: OkfChange[];
}

/** What each kind means in the printed report. */
export const OKF_CHANGE_DESCRIPTIONS: Record<OkfChangeKind, string> = {
  'default-type': 'notes without a type given the default type',
  'multi-type': 'list types reduced to their first entry as "type", the full list kept as "types"',
  'added-title': 'titles added from the first heading or file name',
  'added-description': 'descriptions added from the first paragraph',
  wikilink: 'wikilinks rewritten as bundle-absolute markdown links',
  'broken-link': 'links to notes outside the export kept as links to not-yet-written concepts',
  transclusion: '![[note]] embeds turned into plain links',
  attachment: 'attachment embeds turned into markdown images (files copied)',
  'edge-embed': '{{edge: ...}} embeds replaced by their value as text (or removed when unresolved)',
  'renamed-reserved': 'notes named index.md or log.md renamed, links follow',
  'generated-index': 'directory index.md files generated',
  'invalid-frontmatter': 'notes with unparseable frontmatter left as written (not conformant)',
};

const RESERVED = new Set(['index.md', 'log.md']);
const WIKI = /(!?)\[\[([^\]|\r\n]+)(?:\|([^\]\r\n]+))?\]\]/g;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const EDGE_LINE = /^\s*(?:(?:[-*+]|\d+[.)])\s+|>\s*)*[+-]?[\p{L}_][\p{L}\p{N}_-]*::/u;

const baseName = (p: string): string => p.slice(p.lastIndexOf('/') + 1);
const dirName = (p: string): string => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const stem = (p: string): string => baseName(p).replace(/\.md$/i, '');

/** Percent-encode only what breaks a markdown link destination, keeping paths readable. */
export function encodePath(path: string): string {
  return path.replace(/[%\s()<>#?[\]]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

/** GitHub-style heading anchor. */
export function slugify(heading: string): string {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}

/** Map notes named `index.md` / `log.md` to free `-note` names. */
function reservedRenames(paths: string[], report: Report<OkfChangeKind>): Map<string, string> {
  const taken = new Set(paths.map((p) => p.toLowerCase()));
  const out = new Map<string, string>();
  for (const p of paths) {
    if (!RESERVED.has(baseName(p).toLowerCase())) continue;
    const dir = dirName(p);
    const base = stem(p);
    let n = 1;
    let next = '';
    do next = `${dir ? `${dir}/` : ''}${base}-note${n === 1 ? '' : `-${n}`}.md`;
    while (taken.has(next.toLowerCase()) && ++n);
    taken.add(next.toLowerCase());
    out.set(p, next);
    report.add('renamed-reserved', `${p} -> ${next}`);
  }
  return out;
}

/** First level-1 heading of a note body, if any. */
function firstHeading(body: string): string | null {
  let fence = false;
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) continue;
    const h = HEADING.exec(line);
    if (h && h[1] === '#') return h[2]!.trim() || null;
  }
  return null;
}

/** First sentence of the first prose paragraph, with link syntax reduced to its text. */
function firstSentence(body: string): string | null {
  const para: string[] = [];
  let fence = false;
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      if (para.length) break;
      continue;
    }
    if (fence) continue;
    const t = line.trim();
    const prose = t !== '' && !HEADING.test(t) && !/^([-*+>|]|\d+[.)]|<|\{\{|!\[|---)/.test(t) && !EDGE_LINE.test(t);
    if (prose) para.push(t);
    else if (para.length) break;
  }
  if (!para.length) return null;
  const text = para
    .join(' ')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/!?\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_m, t: string, a?: string) => (a ?? t.split('#')[0]!.split('/').pop()!).trim())
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const end = text.search(/[.!?](\s|$)/);
  const sentence = end === -1 ? text : text.slice(0, end + 1);
  if (!sentence) return null;
  return sentence.length > 200 ? `${sentence.slice(0, 197).trimEnd()}...` : sentence;
}

/** Remove a top-level YAML key and its indented or block-sequence continuation lines. */
function dropKey(yaml: string, key: string): string {
  const lines = yaml.split('\n');
  const at = lines.findIndex((l) => new RegExp(`^["']?${key}["']?\\s*:`).test(l));
  if (at === -1) return yaml;
  let end = at + 1;
  while (end < lines.length && (/^[ \t]/.test(lines[end]!) || /^- /.test(lines[end]!) || lines[end] === '-')) end++;
  lines.splice(at, end - at);
  return lines.join('\n');
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

interface Meta {
  title: string;
  description: string | null;
}

/** Give a concept a string `type`, and a `title` and `description` when missing; other keys stay as written. */
function conceptFrontmatter(note: OkfNote, body: string, defaultType: string, report: Report<OkfChangeKind>): { text: string; meta: Meta } {
  const { yaml } = splitFrontmatter(note.text);
  const fm = note.frontmatter ?? {};
  const title = nonEmpty(fm.title) ? fm.title.trim() : firstHeading(body) ?? stem(note.path);
  const existingDescription = nonEmpty(fm.description) ? fm.description.trim() : null;
  if (yaml !== null && note.frontmatterError) {
    report.add('invalid-frontmatter', note.path);
    return { text: note.text, meta: { title, description: existingDescription } };
  }

  const add: Record<string, unknown> = {};
  let rest = yaml ?? '';
  const t = fm.type;
  if (nonEmpty(t)) {
    // already a usable type
  } else if (Array.isArray(t) && t.some(nonEmpty)) {
    const all = t.filter(nonEmpty).map((x) => x.trim());
    add.type = all[0];
    add.types = all;
    rest = dropKey(rest, 'type');
    report.add('multi-type', note.path);
  } else if (typeof t === 'number') {
    add.type = String(t);
    rest = dropKey(rest, 'type');
  } else {
    add.type = defaultType;
    rest = dropKey(rest, 'type');
    report.add('default-type', note.path);
  }
  if (!nonEmpty(fm.title)) {
    add.title = title;
    report.add('added-title', note.path);
  }
  let description = existingDescription;
  if (!description) {
    description = firstSentence(body);
    if (description) {
      add.description = description;
      report.add('added-description', note.path);
    }
  }
  const head = toYaml(add);
  const block = [head, rest.replace(/^\n+|\n+$/g, '')].filter(Boolean).join('\n');
  return { text: `---\n${block}\n---\n${body.startsWith('\n') ? '' : '\n'}${body}`, meta: { title, description } };
}

/** Rewrite wikilinks outside code as standard markdown links; typed edge lines keep their type, sign and properties. */
function rewriteLinks(
  path: string,
  text: string,
  resolveNote: (link: string) => string | null,
  resolveAttachment: (link: string) => string | null,
  usedAttachments: Set<string>,
  report: Report<OkfChangeKind>,
): string {
  return mapProse(text, (line, n) =>
    outsideCode(line, (part) =>
      part.replace(WIKI, (_whole, bang: string, rawTarget: string, alias: string | undefined) => {
        const where = `${path}:${n}`;
        const [filePart = '', ...subs] = rawTarget.trim().split('#');
        const heading = subs.filter(Boolean).pop() ?? null;
        const anchor = heading ? `#${slugify(heading)}` : '';
        const label = (alias ?? (filePart ? filePart.replace(/\.md$/i, '').split('/').pop()! : heading ?? '')).trim();
        if (!filePart) {
          report.add('wikilink', where);
          return `[${label}](${anchor || '#'})`;
        }
        const note = resolveNote(filePart);
        if (bang) {
          if (note) {
            report.add('transclusion', where);
            return `[${label}](/${encodePath(note)}${anchor})`;
          }
          const file = resolveAttachment(filePart);
          if (file) usedAttachments.add(file);
          report.add('attachment', where);
          return `![${alias?.trim() ?? baseName(filePart)}](/${encodePath(file ?? filePart)})`;
        }
        report.add('wikilink', where);
        if (note) return `[${label}](/${encodePath(note)}${anchor})`;
        report.add('broken-link', where);
        const missing = /\.md$/i.test(filePart) ? filePart : `${filePart}.md`;
        return `[${label}](/${encodePath(missing.replace(/^\/+/, ''))}${anchor})`;
      }),
    ),
  );
}

/** One `index.md` per directory: concepts with their descriptions, then subdirectories; frontmatter only at the root. */
function indexFiles(metas: Map<string, Meta>, title: string): OkfFile[] {
  const dirs = new Set<string>(['']);
  for (const p of metas.keys()) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  const files: OkfFile[] = [];
  for (const dir of [...dirs].sort()) {
    const prefix = dir ? `${dir}/` : '';
    const concepts = [...metas]
      .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .sort(([, a], [, b]) => a.title.localeCompare(b.title));
    const subdirs = [...dirs].filter((d) => d !== dir && d.startsWith(prefix) && !d.slice(prefix.length).includes('/')).sort();
    const lines: string[] = [];
    if (dir === '') lines.push('---', `okf_version: "${OKF_VERSION}"`, '---', '');
    lines.push(`# ${dir === '' ? title : baseName(dir)}`, '');
    if (concepts.length) for (const [p, m] of concepts) lines.push(`* [${m.title}](${encodePath(baseName(p))})${m.description ? ` - ${m.description}` : ''}`);
    else lines.push('No concepts directly in this directory.');
    if (subdirs.length) {
      lines.push('', '# Subdirectories', '');
      for (const d of subdirs) {
        const count = [...metas.keys()].filter((p) => p.startsWith(`${d}/`)).length;
        lines.push(`* [${baseName(d)}](${encodePath(baseName(d))}/) - ${count} concept${count === 1 ? '' : 's'}`);
      }
    }
    files.push({ path: `${prefix}index.md`, text: `${lines.join('\n')}\n` });
  }
  return files;
}

/**
 * Project vault notes into an Open Knowledge Format bundle: wikilinks become
 * bundle-absolute markdown links, typed edge lines keep their type, sign and
 * properties (so the graph reads back the same), every concept gets a string
 * `type` plus a title and description when missing, reserved file names are
 * renamed, and every directory gets an `index.md`. The report says what changed;
 * the caller verifies the result with `checkOkf`.
 */
// @lat: [[okf#Export]]
export function exportOkf(notes: OkfNote[], options: OkfExportOptions = {}): OkfExportResult {
  const report = new Report<OkfChangeKind>();
  const defaultType = options.defaultType?.trim() || 'Note';
  const paths = notes.map((n) => n.path);
  const renames = reservedRenames(paths, report);
  const mapped = (p: string): string => renames.get(p) ?? p;
  const noteResolver = pathResolver(() => paths);
  const attachmentPaths = options.attachments ?? [];
  const graph = new Graph(noteResolver);
  for (const n of notes) graph.upsertNote({ path: n.path, text: n.text, frontmatter: null });

  const used = new Set<string>();
  const metas = new Map<string, Meta>();
  const files: OkfFile[] = [];
  for (const note of notes) {
    const resolveNote = (link: string): string | null => {
      const r = noteResolver(link, note.path);
      return r ? mapped(r) : null;
    };
    const resolveAttachment = (link: string): string | null => {
      const target = link.trim().replace(/^\/+/, '').toLowerCase();
      if (!target || /\.md$/.test(target)) return null;
      const hits = attachmentPaths.filter((p) => p.toLowerCase() === target || p.toLowerCase().endsWith(`/${target}`));
      return hits.sort((a, b) => a.length - b.length)[0] ?? null;
    };
    let text = note.text.replace(/\r\n/g, '\n');
    text = expandEmbeds(note.path, text, graph, report);
    text = rewriteLinks(note.path, text, resolveNote, resolveAttachment, used, report);
    const fixed = conceptFrontmatter({ ...note, text }, splitFrontmatter(text).body, defaultType, report);
    const out = mapped(note.path);
    metas.set(out, fixed.meta);
    files.push({ path: out, text: fixed.text });
  }
  for (const idx of indexFiles(metas, options.title?.trim() || 'Knowledge bundle')) {
    files.push(idx);
    report.add('generated-index', idx.path);
  }
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), attachments: [...used].sort(), report: report.entries() };
}
