import { parseEdges, type Diagnostic, type Sign } from '../edges/parse.js';
import type { Props } from '../edges/props.js';
import type { LatIndex, LinkResult } from '../latmd/index.js';
import type { TypeSchema } from '../schema/schema.js';
import { scanFile, type CodeSymbol } from './symbols.js';

export interface AnnotationEdge {
  type: string;
  sign: Sign;
  /** Full link target including any `#subpath`, as written. */
  target: string;
  props: Props;
}

export type AnnotationSource = { kind: 'symbol'; name: string; parent: string | null; symbolPath: string; line: number } | { kind: 'file' };

export interface Annotation {
  /** `lat` for `@lat:` links, `tg` for `@tg:` typed edges. */
  kind: 'lat' | 'tg';
  file: string;
  /** 1-based line of the annotation comment. */
  line: number;
  edges: AnnotationEdge[];
  source: AnnotationSource;
}

export interface AnnotationScan {
  annotations: Annotation[];
  diagnostics: Diagnostic[];
}

/** How far after a comment run a declaration may start and still be annotated. */
export const ATTACH_WINDOW = 3;

// Identical to lat.md's pattern so both tools see the same `@lat:` references.
const LAT_REF = /(?:\/\/|#)\s*@lat:\s*\[\[([^\]]+)\]\]/g;
const TG_REF = /(?:\/\/+|#+|--|\/\*+|\*+|<!--|;+)\s*@tg:\s*(.*)$/;
const COMMENT_LINE = /^\s*(?:\/\/|#|\*|\/\*|\*\/|--|<!--)/;
const SEGMENT_SPLIT = /,\s*(?=[+-]?[\p{L}_][\p{L}\p{N}_-]*::)/u;

/** Split `a:: [[x]], b:: [[y]] {p: 1, q: 2}` into edge segments without cutting property blocks. */
function splitSegments(payload: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < payload.length; i++) {
    const c = payload[i];
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0 && SEGMENT_SPLIT.test(payload.slice(i))) {
      out.push(payload.slice(start, i));
      start = i + 1;
    }
  }
  out.push(payload.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

function parsePayload(payload: string, path: string, line: number): { edges: AnnotationEdge[]; diagnostics: Diagnostic[] } {
  const edges: AnnotationEdge[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const raw of splitSegments(payload.replace(/\s*(?:\*\/|-->)\s*$/, ''))) {
    const seg = raw.startsWith('[[') ? `references:: ${raw}` : raw;
    const r = parseEdges(seg, path);
    for (const e of r.edges) edges.push({ type: e.type, sign: e.sign, target: e.subpath ? `${e.target}#${e.subpath}` : e.target, props: e.props });
    for (const d of r.diagnostics) diagnostics.push({ ...d, line });
    if (r.edges.length === 0 && r.diagnostics.length === 0) {
      diagnostics.push({ path, line, column: 0, message: `@tg: could not read an edge from "${raw}"; expected \`type:: [[Target]] {props}\` or \`[[Target]]\`` });
    }
  }
  return { edges, diagnostics };
}

/** 0-based index of the last line of the comment run that starts at `idx`. */
function commentRunEnd(lines: string[], idx: number): number {
  let end = idx;
  while (end + 1 < lines.length && COMMENT_LINE.test(lines[end + 1]!)) end++;
  return end;
}

function attach(symbols: CodeSymbol[] | null, runEnd1: number): AnnotationSource {
  if (!symbols) return { kind: 'file' };
  let best: CodeSymbol | null = null;
  for (const s of symbols) {
    if (s.startLine > runEnd1 && s.startLine <= runEnd1 + ATTACH_WINDOW && (!best || s.startLine < best.startLine)) best = s;
  }
  if (!best) return { kind: 'file' };
  return { kind: 'symbol', name: best.name, parent: best.parent, symbolPath: best.parent ? `${best.parent}#${best.name}` : best.name, line: best.startLine };
}

/**
 * Find `@lat:` and `@tg:` annotations in one source file. `path` is
 * project-relative. Annotations attach to the declaration that follows the
 * comment within {@link ATTACH_WINDOW} lines, else to the file with a warning.
 */
// @lat: [[cli#Annotations]]
export function scanAnnotations(path: string, text: string): AnnotationScan {
  const annotations: Annotation[] = [];
  const diagnostics: Diagnostic[] = [];
  if (!text.includes('@lat:') && !text.includes('@tg:')) return { annotations, diagnostics };
  const lines = text.split(/\r?\n/);
  let symbols: CodeSymbol[] | null | undefined;
  const symbolsOf = (): CodeSymbol[] | null => (symbols === undefined ? (symbols = scanFile(path, text)?.symbols ?? null) : symbols);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.includes('@lat:') && !line.includes('@tg:')) continue;
    const runEnd1 = commentRunEnd(lines, i) + 1;
    LAT_REF.lastIndex = 0;
    for (let m = LAT_REF.exec(line); m; m = LAT_REF.exec(line)) {
      annotations.push({ kind: 'lat', file: path, line: i + 1, edges: [{ type: 'references', sign: 1, target: m[1]!, props: {} }], source: attach(symbolsOf(), runEnd1) });
    }
    const tg = TG_REF.exec(line);
    if (tg) {
      const { edges, diagnostics: d } = parsePayload(tg[1]!, path, i + 1);
      diagnostics.push(...d);
      if (edges.length) {
        const source = attach(symbolsOf(), runEnd1);
        if (source.kind === 'file') diagnostics.push({ path, line: i + 1, column: 0, message: `@tg: annotation is not followed by a declaration within ${ATTACH_WINDOW} lines; attached to the file` });
        annotations.push({ kind: 'tg', file: path, line: i + 1, edges, source });
      }
    }
  }
  return { annotations, diagnostics };
}

export type AnnotationIssue =
  | { kind: 'broken'; target: string; message: string; suggestion: string | null }
  | { kind: 'ambiguous'; target: string; candidates: string[]; suggested: string | null }
  /** A source link: the caller still has to verify the file and symbol on disk. */
  | { kind: 'code'; target: string; file: string; symbol: string | null };

/** Resolve one annotation edge against the lattice; null means it points at an existing section. */
export function checkAnnotationTarget(index: LatIndex, edge: AnnotationEdge): AnnotationIssue | null {
  const r: LinkResult = index.resolve(edge.target);
  switch (r.kind) {
    case 'section':
      return null;
    case 'code':
      return { kind: 'code', target: edge.target, file: r.file, symbol: r.symbol };
    case 'ambiguous':
      return { kind: 'ambiguous', target: edge.target, candidates: r.candidates, suggested: r.suggested };
    case 'missing':
      return { kind: 'broken', target: edge.target, message: r.reason === 'unsupported-extension' ? `unsupported file extension "${r.ext}"` : 'no matching section found', suggestion: r.suggestion };
  }
}

/** Advisory schema check: edge types an annotated code symbol's schema does not allow. */
export function schemaIssues(schema: TypeSchema | undefined, annotation: Annotation): string[] {
  if (!schema?.edges) return [];
  return annotation.edges.filter((e) => !schema.edges!.includes(e.type)).map((e) => `Edge type '${e.type}' is not allowed for ${schema.type} (allowed: ${schema.edges!.join(', ') || 'none'})`);
}
