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

/** List markdown files, skipping dot folders such as `.obsidian` and `.trash`. */
export async function listMarkdown(vaultDir: string): Promise<FileInfo[]> {
  const out: FileInfo[] = [];
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const s = await stat(full);
        out.push({ path: toVaultPath(vaultDir, full), mtimeMs: s.mtimeMs, size: s.size });
      }
    }
  };
  await walk(vaultDir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function toVaultPath(vaultDir: string, full: string): string {
  return relative(vaultDir, full).split(sep).join('/');
}

export function isNotePath(path: string): boolean {
  return path.toLowerCase().endsWith('.md') && !path.split('/').some((seg) => seg.startsWith('.'));
}

export interface ReadNote {
  note: NoteInput;
  hash: string;
  frontmatterError: string | null;
}

/** Read a note (read-only) and parse its YAML frontmatter like Obsidian does. */
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
