/** Extensions a `[[src/foo.ts#symbol]]` link may point at; lat.md's set plus Node ES-module and CommonJS TypeScript/JavaScript. */
export const LAT_SOURCE_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.c', '.h']);

/** Extensions tg adds on top of lat.md; recorded as intentional differences. */
// @tg: implements:: [[openspec:tg-check#Parity with lat.md]]
export const TG_SOURCE_EXTENSIONS: ReadonlySet<string> = new Set(['.mts', '.cts', '.mjs', '.cjs']);

export const SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([...LAT_SOURCE_EXTENSIONS, ...TG_SOURCE_EXTENSIONS]);

export function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

export function extOf(file: string): string {
  const base = file.slice(file.lastIndexOf('/') + 1);
  const i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.slice(i);
}

/** Split `file#a#b` at the first `#`: the file part and the rest after it (without the `#`). */
export function splitTarget(target: string): { file: string; rest: string | null } {
  const i = target.indexOf('#');
  return i === -1 ? { file: target, rest: null } : { file: target.slice(0, i), rest: target.slice(i + 1) };
}

/** True when the file part of a link target has a supported source extension. */
// @tg: implements:: [[openspec:lat-resolver#Link resolution]]
export function isSourceTarget(target: string): boolean {
  return SOURCE_EXTENSIONS.has(extOf(splitTarget(target).file));
}
