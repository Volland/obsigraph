import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitFrontmatter, type OkfNote } from '@obsigraph/core';
import { parse as parseYaml } from 'yaml';
import { walkProject } from './walk.mjs';

/** Read every markdown file under `dir` with its frontmatter parsed as YAML, plus the paths of all other files. */
export function readOkfNotes(dir: string): { notes: OkfNote[]; others: string[] } {
  const notes: OkfNote[] = [];
  const others: string[] = [];
  for (const path of walkProject(dir)) {
    if (!path.toLowerCase().endsWith('.md')) {
      others.push(path);
      continue;
    }
    const text = readFileSync(join(dir, path), 'utf8');
    const { yaml } = splitFrontmatter(text);
    let frontmatter: Record<string, unknown> | null = null;
    let frontmatterError: string | null = null;
    if (yaml !== null) {
      try {
        const parsed: unknown = parseYaml(yaml);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) frontmatter = parsed as Record<string, unknown>;
        else if (parsed !== null && parsed !== undefined) frontmatterError = 'frontmatter is not a mapping';
      } catch (e) {
        frontmatterError = (e as Error).message.split('\n')[0]!;
      }
    }
    notes.push({ path, text, frontmatter, frontmatterError });
  }
  return { notes, others };
}
