export type LineKind =
  | 'blank'
  /** A `// text` line comment. */
  | 'comment'
  /** The opening `////` line of a comment block. */
  | 'comment-open'
  | 'comment-body'
  | 'comment-close'
  /** Opening or closing line of a delimited block other than a comment block. */
  | 'delim'
  /** `=` to `======` title; `level` 0 is the document title. */
  | 'title'
  | 'attr'
  /** `[...]` block attribute line, anchors excluded. */
  | 'blockattr'
  /** `[[id]]` anchor line. */
  | 'anchor'
  | 'include'
  | 'content';

export interface ScannedLine {
  /** Zero-based line number. */
  n: number;
  text: string;
  kind: LineKind;
  /** Inside a delimited block (any kind, comment blocks included) at this line. */
  inBlock: boolean;
  /** Inside a verbatim block (listing, literal, passthrough, comment, table, fence) at this line. */
  verbatim: boolean;
  /** `title`: number of `=` minus one. */
  level?: number;
  /** `title`: heading text. */
  title?: string;
  /** `attr`: attribute name and value; `unset` for `:name!:` and `:!name:`. */
  name?: string;
  value?: string;
  unset?: boolean;
  /** `anchor`: the id. `include`: the target as written. */
  id?: string;
  target?: string;
  /** `include` attribute list as written. */
  attrs?: string;
}

const DELIM = /^(?:-{4,}|\.{4,}|={4,}|\*{4,}|_{4,}|\+{4,}|\/{4,}|\|={3,}|--)$/;
const FENCE = /^(`{3,})[\w+#.-]*$/;
const TITLE = /^(={1,6})[ \t]+(\S.*?)(?:[ \t]+=+)?[ \t]*$/;
const ATTR = /^:(!?[\w][\w-]*!?):(?:[ \t]+(.*?))?[ \t]*$/;
const INCLUDE = /^include::([^[\n]+)\[(.*)\][ \t]*$/;
const ANCHOR = /^\[\[([^\]]+)\]\][ \t]*$/;
const BLOCK_ATTR = /^\[(?!\[).*\][ \t]*$/;

/** Delimiters whose content is not parsed: listing, literal, passthrough, comment, table and fenced code. */
function verbatimDelim(d: string): boolean {
  return /^[-.+/`|]/.test(d) && d !== '--';
}

/**
 * Classify every line of an AsciiDoc file with a stack of open delimiters. A closing delimiter must equal
 * its opener; inside a verbatim block nothing but that closer is recognized.
 */
// @tg: implements:: [[openspec:asciidoc-notes#Sections and id aliases]] {confidence: partial}
export function scanLines(lines: readonly string[]): ScannedLine[] {
  const out: ScannedLine[] = [];
  const stack: string[] = [];
  lines.forEach((raw, n) => {
    const text = raw.replace(/\s+$/, '');
    const top = stack[stack.length - 1];
    const verbatim = top !== undefined && verbatimDelim(top);
    const base = { n, text: raw, inBlock: stack.length > 0, verbatim };
    const push = (kind: LineKind, extra: Partial<ScannedLine> = {}) => out.push({ ...base, kind, ...extra });

    const fence = FENCE.exec(text);
    if (DELIM.test(text) || fence) {
      const d = fence ? fence[1]! : text;
      if (top === d) {
        stack.pop();
        push(d[0] === '/' ? 'comment-close' : 'delim', { inBlock: true, verbatim });
        return;
      }
      if (!verbatim) {
        stack.push(d);
        push(d[0] === '/' ? 'comment-open' : 'delim', { inBlock: true, verbatim: verbatimDelim(d) });
        return;
      }
    }
    if (top?.[0] === '/') return push('comment-body');
    if (text === '') return push('blank');
    if (verbatim) return push('content');
    if (text.startsWith('//') && text[2] !== '/') return push('comment');
    const attr = ATTR.exec(text);
    if (attr) {
      const raw = attr[1]!;
      const unset = raw.startsWith('!') || raw.endsWith('!');
      return push('attr', { name: raw.replace(/^!|!$/g, '').toLowerCase(), value: attr[2] ?? '', unset });
    }
    const inc = INCLUDE.exec(text);
    if (inc) return push('include', { target: inc[1]!.trim(), attrs: inc[2]! });
    const anchor = ANCHOR.exec(text);
    if (anchor) return push('anchor', { id: anchor[1]!.split(',')[0]!.trim() });
    if (BLOCK_ATTR.test(text)) return push('blockattr');
    if (!stack.length) {
      const t = TITLE.exec(text);
      if (t) return push('title', { level: t[1]!.length - 1, title: t[2]! });
    }
    push('content');
  });
  return out;
}
