import { parseProps, PropsSyntaxError, type Props } from './props.js';

export type Sign = 1 | -1;

export interface ParsedEdge {
  /** Edge type with any sign prefix stripped. */
  type: string;
  sign: Sign;
  /** Link path as written, without `#subpath` or `|alias`. */
  target: string;
  subpath: string | null;
  alias: string | null;
  props: Props;
  /** Zero-based line number in the note. */
  line: number;
  /** Nearest preceding heading text, or null at top level. */
  heading: string | null;
}

export interface Diagnostic {
  path: string | null;
  line: number;
  column: number;
  message: string;
}

export interface ParseResult {
  edges: ParsedEdge[];
  diagnostics: Diagnostic[];
}

// Optional list marker or blockquote, optional sign, type, `::`, then the value.
const EDGE_LINE = /^\s*(?:(?:[-*+]|\d+[.)])\s+|>\s*)*([+-]?)([\p{L}_][\p{L}\p{N}_-]*)::\s*(.*)$/u;
const LINK = /\[\[([^\]|#]*)(?:#([^\]|]*))?(?:\|([^\]]*))?\]\]/y;
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/**
 * Extract typed, signed edges from a note body.
 *
 * Recognized form: `[+-]?type:: [[Target]] {props}`; several comma-separated
 * links share the type and props. Lines in fenced code or frontmatter are skipped.
 */
// @lat: [[edge-syntax#Inline edge form]]
export function parseEdges(text: string, path: string | null = null): ParseResult {
  const edges: ParsedEdge[] = [];
  const diagnostics: Diagnostic[] = [];
  const lines = text.split(/\r?\n/);

  let fence: string | null = null;
  let heading: string | null = null;
  let start = 0;

  // Skip YAML frontmatter.
  if (lines[0]?.trim() === '---') {
    const close = lines.findIndex((l, idx) => idx > 0 && (l.trim() === '---' || l.trim() === '...'));
    if (close > 0) start = close + 1;
  }

  for (let n = start; n < lines.length; n++) {
    const line = lines[n]!;

    const f = FENCE.exec(line);
    if (f) {
      if (fence === null) fence = f[1]!;
      else if (f[1] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;

    const h = HEADING.exec(line);
    if (h) {
      heading = h[2]!;
      continue;
    }

    const m = EDGE_LINE.exec(line);
    if (!m) continue;

    const [, signChar, type, value] = m as unknown as [string, string, string, string];
    const valueStart = line.length - value.length;
    const links = scanLinks(value);
    if (links.links.length === 0) continue;

    let props: Props = {};
    let rest = value.slice(links.end).trimStart();
    if (rest.startsWith('{')) {
      const restOffset = value.length - rest.length;
      try {
        props = parseProps(rest).props;
      } catch (err) {
        if (!(err instanceof PropsSyntaxError)) throw err;
        diagnostics.push({
          path,
          line: n,
          column: valueStart + restOffset + err.offset,
          message: `Malformed edge property block: ${err.message}`,
        });
      }
    }

    // @lat: [[edge-syntax#Sign]]
    const sign: Sign = signChar === '-' ? -1 : 1;
    for (const link of links.links) {
      edges.push({ type, sign, ...link, props: { ...props }, line: n, heading });
    }
  }

  return { edges, diagnostics };
}

function scanLinks(value: string): {
  links: Pick<ParsedEdge, 'target' | 'subpath' | 'alias'>[];
  end: number;
} {
  const links: Pick<ParsedEdge, 'target' | 'subpath' | 'alias'>[] = [];
  let i = 0;
  for (;;) {
    while (value[i] === ' ' || value[i] === '\t') i++;
    LINK.lastIndex = i;
    const m = LINK.exec(value);
    if (!m) break;
    const target = m[1]!.trim();
    if (target) {
      links.push({ target, subpath: m[2]?.trim() || null, alias: m[3]?.trim() || null });
    }
    i = LINK.lastIndex;
    let j = i;
    while (value[j] === ' ' || value[j] === '\t') j++;
    if (value[j] !== ',') break;
    i = j + 1;
  }
  return { links, end: i };
}
