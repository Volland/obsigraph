import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { splitFrontmatter, type NoteInput } from '@obsigraph/core';
import { parse as parseYaml } from 'yaml';

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

/** List markdown files, skipping dot folders such as `.obsidian` and `.trash` and any `ignore`d folder name. */
// @tg: implements:: [[openspec:node-vault-loader#List markdown files]]
export function listMarkdown(vaultDir: string, options: ListOptions = {}): Promise<FileInfo[]> {
  return listFiles(vaultDir, { ...options, accept: (name) => name.toLowerCase().endsWith('.md') });
}

export function toVaultPath(vaultDir: string, full: string): string {
  return relative(vaultDir, full).split(sep).join('/');
}

export function isNotePath(path: string, ignore: readonly string[] = []): boolean {
  return path.toLowerCase().endsWith('.md') && !path.split('/').some((seg) => seg.startsWith('.') || ignore.includes(seg));
}

export interface ReadNote {
  note: NoteInput;
  hash: string;
  frontmatterError: string | null;
}

/** Read a note (read-only) and parse its YAML frontmatter like Obsidian does. */
// @tg: implements:: [[openspec:node-vault-loader#No host dependencies]]
// @tg: implements:: [[openspec:node-vault-loader#Read a note read-only]]
export async function readNote(vaultDir: string, path: string): Promise<ReadNote> {
  const text = await readFile(join(vaultDir, ...path.split('/')), 'utf8');
  const hash = createHash('sha256').update(text).digest('hex');
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
