import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { noteFormat, noteFrontmatter, splitFrontmatter, type NoteInput } from '@obsigraph/core';
import { parse as parseYaml } from 'yaml';

/** The YAML parser node hosts hand to the graph for AsciiDoc property blocks. */
export { parseYaml };

export interface FileInfo {
  /** Vault-relative path with `/` separators, as Obsidian uses. */
  path: string;
  mtimeMs: number;
  size: number;
}

export interface ListOptions {
  /** Folder names to skip at any depth, in addition to dot folders. */
  ignore?: readonly string[];
}

export interface ListNotesOptions extends ListOptions {
  /** Also list `.adoc` notes; on by default. */
  asciidoc?: boolean;
}

export interface ListFilesOptions extends ListOptions {
  /** Which file names to include. */
  accept: (name: string) => boolean;
  /** Skip files larger than this many bytes. */
  maxBytes?: number;
}

/** List files accepted by `accept`, skipping dot folders and any `ignore`d folder name; sorted, `/`-separated paths. */
// @tg: implements:: [[openspec:node-vault-loader#List markdown files]]
// @tg: implements:: [[openspec:node-vault-loader#No host dependencies]]
export async function listFiles(dir: string, options: ListFilesOptions): Promise<FileInfo[]> {
  const ignore = new Set(options.ignore ?? []);
  const out: FileInfo[] = [];
  const walk = async (current: string) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignore.has(entry.name)) await walk(full);
      } else if (entry.isFile() && options.accept(entry.name)) {
        const s = await stat(full);
        if (options.maxBytes === undefined || s.size <= options.maxBytes) out.push({ path: toVaultPath(dir, full), mtimeMs: s.mtimeMs, size: s.size });
      }
    }
  };
  await walk(dir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * List note files (`.md` and, unless `asciidoc` is false, `.adoc`), skipping dot folders such as `.obsidian`
 * and `.trash` and any `ignore`d folder name.
 */
// @tg: implements:: [[openspec:node-vault-loader#List markdown files]]
export function listNotes(vaultDir: string, options: ListNotesOptions = {}): Promise<FileInfo[]> {
  const { asciidoc = true, ...rest } = options;
  return listFiles(vaultDir, { ...rest, accept: (name) => isNoteName(name, asciidoc) });
}

/** List markdown files only. */
/** @deprecated Use `listNotes`, which also lists AsciiDoc notes. */
// @tg: implements:: [[openspec:node-vault-loader#List markdown files]]
export function listMarkdown(vaultDir: string, options: ListOptions = {}): Promise<FileInfo[]> {
  return listNotes(vaultDir, { ...options, asciidoc: false });
}

function isNoteName(name: string, asciidoc: boolean): boolean {
  const n = name.toLowerCase();
  return n.endsWith('.md') || (asciidoc && n.endsWith('.adoc'));
}

export function toVaultPath(vaultDir: string, full: string): string {
  return relative(vaultDir, full).split(sep).join('/');
}

/** True for a note path outside dot folders and ignored folders; `.adoc` counts unless `asciidoc` is false. */
export function isNotePath(path: string, ignore: readonly string[] = [], asciidoc = true): boolean {
  return isNoteName(path, asciidoc) && !path.split('/').some((seg) => seg.startsWith('.') || ignore.includes(seg));
}

export interface ReadNote {
  note: NoteInput;
  hash: string;
  frontmatterError: string | null;
}

/**
 * Read a note (read-only) and parse its YAML frontmatter like Obsidian does. For an `.adoc` note the
 * frontmatter is the merged properties of its leading comment block and `:tg-*:` attributes.
 */
// @tg: implements:: [[openspec:node-vault-loader#No host dependencies]]
// @tg: implements:: [[openspec:node-vault-loader#Read a note read-only]]
export async function readNote(vaultDir: string, path: string): Promise<ReadNote> {
  const text = await readFile(join(vaultDir, ...path.split('/')), 'utf8');
  const hash = createHash('sha256').update(text).digest('hex');
  if (noteFormat(path) === 'adoc') {
    const r = noteFrontmatter(path, text, parseYaml);
    return { note: { path, text, frontmatter: r.frontmatter }, hash, frontmatterError: r.error };
  }
  const { yaml } = splitFrontmatter(text);
  let frontmatter: Record<string, unknown> | null = null;
  let frontmatterError: string | null = null;
  if (yaml !== null) {
    try {
      const parsed: unknown = parseYaml(yaml);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) frontmatter = parsed as Record<string, unknown>;
    } catch (e) {
      frontmatterError = (e as Error).message.split('\n')[0]!;
    }
  }
  return { note: { path, text, frontmatter }, hash, frontmatterError };
}
