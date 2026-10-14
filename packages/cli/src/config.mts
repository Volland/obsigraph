import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface TgConfig {
  /** Globs, relative to the project root, of `.adoc` files read as notes. */
  notes: string[];
}

/** Where the committed config lives; the derived caches beside it are ignored. */
export const CONFIG_FILE = '.tg/config.json';

/** Contents of the `.tg/.gitignore` that keeps derived files out of git but `config.json` in. */
export const TG_GITIGNORE = 'vectors.json\nvectors.f32\n';

/**
 * Read `.tg/config.json`: `{ "notes": ["book/**\/*.adoc"] }`. A missing file is the empty config; a broken one
 * is reported in `error` and also yields the empty config, so a typo never hides the rest of the project.
 */
// @tg: implements:: [[openspec:asciidoc-notes#Hosts index AsciiDoc notes]] {confidence: partial}
export function readConfig(root: string): { config: TgConfig; error: string | null } {
  let raw: string;
  try {
    raw = readFileSync(join(root, CONFIG_FILE), 'utf8');
  } catch {
    return { config: { notes: [] }, error: null };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const notes = (parsed as { notes?: unknown } | null)?.notes;
    if (notes === undefined) return { config: { notes: [] }, error: null };
    if (!Array.isArray(notes) || notes.some((n) => typeof n !== 'string')) return { config: { notes: [] }, error: `${CONFIG_FILE}: "notes" must be a list of glob strings` };
    return { config: { notes: notes as string[] }, error: null };
  } catch (e) {
    return { config: { notes: [] }, error: `${CONFIG_FILE}: ${(e as Error).message.split('\n')[0]}` };
  }
}
