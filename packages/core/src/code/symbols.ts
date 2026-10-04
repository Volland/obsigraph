import { maskCode, type Lang } from './mask.js';

export type { Lang } from './mask.js';

export type SymbolKind = 'function' | 'class' | 'method' | 'const' | 'variable' | 'type' | 'interface' | 'enum' | 'struct' | 'trait' | 'module' | 'macro' | 'field' | 'constant';

export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  /** Enclosing class, struct, impl type or trait; null for top-level symbols. */
  parent: string | null;
  /** 1-based, inclusive. */
  startLine: number;
  endLine: number;
  signature: string;
}

export interface ScanResult {
  symbols: CodeSymbol[];
  /** False when the file's strings, comments or braces did not balance, so absence proves nothing. */
  reliable: boolean;
}

export interface SymbolProvider {
  /** Scan one file's text. Must not throw on malformed input. */
  scan(text: string, lang: Lang): ScanResult;
}

const EXT_LANG: Record<string, Lang> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.mts': 'typescript', '.cts': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.c': 'c', '.h': 'c',
};

export function langOfFile(path: string): Lang | null {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const i = base.lastIndexOf('.');
  return i <= 0 ? null : (EXT_LANG[base.slice(i)] ?? null);
}

// ---- scanning helpers -----------------------------------------------------

interface Doc {
  lines: string[];
  /** Brace depth at the start of each line. */
  depth: number[];
  /** Offset of each line start in the masked text. */
  offsets: number[];
  masked: string;
  balanced: boolean;
}

function prepare(text: string, lang: Lang): { doc: Doc; maskedOk: boolean } {
  const m = maskCode(text, lang);
  const lines = m.text.split('\n');
  const depth: number[] = [];
  const offsets: number[] = [];
  let d = 0;
  let off = 0;
  for (const l of lines) {
    depth.push(Math.max(d, 0));
    offsets.push(off);
    for (const c of l) {
      if (c === '{') d++;
      else if (c === '}') d--;
    }
    off += l.length + 1;
  }
  return { doc: { lines, depth, offsets, masked: m.text, balanced: d === 0 }, maskedOk: m.ok };
}

function lineOf(doc: Doc, offset: number): number {
  let lo = 0;
  let hi = doc.offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (doc.offsets[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** 0-based index of the line where the declaration starting on `line` ends: its matching `}` or terminating `;`. */
function declEnd(doc: Doc, line: number): number {
  const s = doc.masked;
  let parens = 0;
  for (let i = doc.offsets[line]!; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') parens++;
    else if (c === ')' || c === ']') parens--;
    else if (c === ';' && parens <= 0) return lineOf(doc, i);
    else if (c === '{' && parens <= 0) {
      let d = 0;
      for (let j = i; j < s.length; j++) {
        if (s[j] === '{') d++;
        else if (s[j] === '}' && --d === 0) return lineOf(doc, j);
      }
      return doc.lines.length - 1;
    }
  }
  return line;
}

function sig(src: string[], line: number): string {
  return (src[line] ?? '').trim().slice(0, 160);
}

type Push = (name: string, kind: SymbolKind, parent: string | null, line: number, end?: number) => void;

function collector(src: string[], doc: Doc): { symbols: CodeSymbol[]; push: Push; partial: (line: number, end: number) => boolean } {
  const symbols: CodeSymbol[] = [];
  let partialSeen = false;
  const push: Push = (name, kind, parent, line, end) => {
    symbols.push({ name, kind, parent, startLine: line + 1, endLine: (end ?? declEnd(doc, line)) + 1, signature: sig(src, line) });
  };
  /** A body written on its own declaration line is not scanned for members, so absence in such a file proves nothing. */
  const partial = (line: number, end: number): boolean => {
    if (end === line && /\{[^}]*\S[^}]*\}/.test(doc.lines[line]!)) partialSeen = true;
    return partialSeen;
  };
  return { symbols, push, partial };
}

// ---- TypeScript / JavaScript ---------------------------------------------

const NOT_METHOD = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'with', 'new', 'else', 'do', 'try', 'typeof', 'await', 'yield', 'super', 'throw']);
const TS_FN = /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/;
const TS_CLASS = /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/;
const TS_VAR = /^\s*(?:export\s+)?(?:declare\s+)?(const|let|var)\s+([A-Za-z_$][\w$]*)/;
const TS_TYPE = /^\s*(?:export\s+)?(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)\s*(?:<|=)/;
const TS_IFACE = /^\s*(?:export\s+)?(?:declare\s+)?interface\s+([A-Za-z_$][\w$]*)/;
const TS_ENUM = /^\s*(?:export\s+)?(?:declare\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/;
const TS_METHOD = /^\s*(?:(?:public|private|protected|static|readonly|override|abstract|async|declare|get|set|accessor)\s+)*\*?\s*([A-Za-z_$#][\w$]*)\s*(?:<[^()]*>)?\s*\(/;
const TS_PROP_FN = /^\s*(?:(?:public|private|protected|static|readonly|override|declare|accessor)\s+)*([A-Za-z_$#][\w$]*)\s*(?::[^=]*)?=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*(?::[^=]*)?=>|^\s*(?:(?:public|private|protected|static|readonly)\s+)*([A-Za-z_$#][\w$]*)\s*=\s*(?:async\s+)?function\b/;

function scanScript(text: string, lang: Lang): ScanResult {
  const { doc, maskedOk } = prepare(text, lang);
  const src = text.split('\n');
  const { symbols, push, partial } = collector(src, doc);
  let sawPartial = false;
  for (let i = 0; i < doc.lines.length; i++) {
    if (doc.depth[i] !== 0) continue;
    const l = doc.lines[i]!;
    let m: RegExpExecArray | null;
    if ((m = TS_FN.exec(l))) push(m[1]!, 'function', null, i);
    else if ((m = TS_CLASS.exec(l))) {
      const end = declEnd(doc, i);
      push(m[1]!, 'class', null, i, end);
      sawPartial = partial(i, end) || sawPartial;
      for (let j = i + 1; j <= end; j++) {
        if (doc.depth[j] !== doc.depth[i]! + 1) continue;
        const ml = doc.lines[j]!;
        const mm = TS_METHOD.exec(ml);
        if (mm && !NOT_METHOD.has(mm[1]!)) push(mm[1]!, 'method', m[1]!, j);
        else {
          const pf = TS_PROP_FN.exec(ml);
          if (pf) push((pf[1] ?? pf[2])!, 'method', m[1]!, j);
        }
      }
    } else if ((m = TS_VAR.exec(l))) push(m[2]!, m[1] === 'var' ? 'variable' : 'const', null, i);
    else if ((m = TS_IFACE.exec(l))) push(m[1]!, 'interface', null, i);
    else if ((m = TS_ENUM.exec(l))) push(m[1]!, 'enum', null, i);
    else if ((m = TS_TYPE.exec(l))) push(m[1]!, 'type', null, i);
  }
  return { symbols, reliable: maskedOk && doc.balanced && !sawPartial };
}

// ---- Python ---------------------------------------------------------------

function scanPython(text: string): ScanResult {
  const m = maskCode(text, 'python');
  const lines = m.text.split('\n');
  const src = text.split('\n');
  const symbols: CodeSymbol[] = [];
  const indentOf = (l: string) => l.length - l.trimStart().length;
  const endOf = (from: number, indent: number): number => {
    let end = from;
    for (let j = from + 1; j < lines.length; j++) {
      if (lines[j]!.trim() === '') continue;
      if (indentOf(lines[j]!) <= indent) break;
      end = j;
    }
    return end;
  };
  const add = (name: string, kind: SymbolKind, parent: string | null, i: number, end: number) =>
    symbols.push({ name, kind, parent, startLine: i + 1, endLine: end + 1, signature: sig(src, i) });
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    let mm: RegExpExecArray | null;
    if ((mm = /^(?:async\s+)?def\s+([A-Za-z_]\w*)/.exec(l))) add(mm[1]!, 'function', null, i, endOf(i, 0));
    else if ((mm = /^class\s+([A-Za-z_]\w*)/.exec(l))) {
      const end = endOf(i, 0);
      add(mm[1]!, 'class', null, i, end);
      let bodyIndent = -1;
      for (let j = i + 1; j <= end; j++) {
        if (lines[j]!.trim() === '') continue;
        if (bodyIndent === -1) bodyIndent = indentOf(lines[j]!);
        if (indentOf(lines[j]!) !== bodyIndent) continue;
        const d = /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/.exec(lines[j]!);
        if (d) add(d[1]!, 'method', mm[1]!, j, endOf(j, bodyIndent));
      }
    } else if ((mm = /^([A-Za-z_]\w*)\s*(?::[^=]+)?=(?!=)/.exec(l))) add(mm[1]!, 'variable', null, i, i);
  }
  return { symbols, reliable: m.ok };
}

// ---- Go -------------------------------------------------------------------

function scanGo(text: string): ScanResult {
  const { doc, maskedOk } = prepare(text, 'go');
  const src = text.split('\n');
  const { symbols, push } = collector(src, doc);
  let group: 'const' | 'var' | 'type' | null = null;
  for (let i = 0; i < doc.lines.length; i++) {
    const l = doc.lines[i]!;
    if (doc.depth[i] !== 0) continue;
    let m: RegExpExecArray | null;
    if (group) {
      if (/^\s*\)/.test(l)) {
        group = null;
        continue;
      }
      if ((m = /^\s*([A-Za-z_]\w*)/.exec(l)) && !/^\s*\/\//.test(l)) push(m[1]!, group === 'type' ? 'type' : 'const', null, i, i);
      continue;
    }
    if ((m = /^func\s*\(\s*(?:[A-Za-z_]\w*\s+)?\*?\s*([A-Za-z_]\w*)(?:\[[^\]]*\])?\s*\)\s*([A-Za-z_]\w*)/.exec(l))) push(m[2]!, 'method', m[1]!, i);
    else if ((m = /^func\s+([A-Za-z_]\w*)/.exec(l))) push(m[1]!, 'function', null, i);
    else if ((m = /^type\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*(struct|interface)?/.exec(l))) push(m[1]!, m[2] === 'struct' ? 'struct' : m[2] === 'interface' ? 'interface' : 'type', null, i);
    else if (/^(const|var|type)\s*\(\s*$/.test(l)) group = /^(\w+)/.exec(l)![1] as 'const' | 'var' | 'type';
    else if ((m = /^(const|var)\s+([A-Za-z_]\w*)/.exec(l))) push(m[2]!, 'const', null, i);
  }
  return { symbols, reliable: maskedOk && doc.balanced };
}

// ---- Rust -----------------------------------------------------------------

const VIS = '(?:pub(?:\\([^)]*\\))?\\s+)?';
const RS_FN = new RegExp(`^\\s*${VIS}(?:default\\s+)?(?:const\\s+)?(?:async\\s+)?(?:unsafe\\s+)?(?:extern\\s+(?:"[^"]*"\\s+)?)?fn\\s+([A-Za-z_]\\w*)`);
const RS_ITEM = new RegExp(`^\\s*${VIS}(struct|enum|trait|type|mod|union|static|const)\\s+(?:mut\\s+)?([A-Za-z_]\\w*)`);
const RS_IMPL = /^\s*(?:unsafe\s+)?impl\b(?:\s*<[^{]*?>)?\s+(?:[^{]*?\bfor\s+)?([A-Za-z_][\w:]*)/;
const RS_KIND: Record<string, SymbolKind> = { struct: 'struct', enum: 'enum', trait: 'trait', type: 'type', mod: 'module', union: 'struct', static: 'const', const: 'const' };

function scanRust(text: string): ScanResult {
  const { doc, maskedOk } = prepare(text, 'rust');
  const src = text.split('\n');
  const { symbols, push, partial } = collector(src, doc);
  let sawPartial = false;
  for (let i = 0; i < doc.lines.length; i++) {
    if (doc.depth[i] !== 0) continue;
    const l = doc.lines[i]!;
    let m: RegExpExecArray | null;
    if ((m = RS_FN.exec(l))) push(m[1]!, 'function', null, i);
    else if ((m = RS_IMPL.exec(l))) {
      const parent = m[1]!.split('::').pop()!;
      const end = declEnd(doc, i);
      sawPartial = partial(i, end) || sawPartial;
      for (let j = i + 1; j <= end; j++) {
        if (doc.depth[j] !== 1) continue;
        const f = RS_FN.exec(doc.lines[j]!);
        if (f) push(f[1]!, 'method', parent, j);
      }
    } else if ((m = RS_ITEM.exec(l))) {
      const kind = RS_KIND[m[1]!]!;
      const end = declEnd(doc, i);
      push(m[2]!, kind, null, i, end);
      if (m[1] === 'trait' || m[1] === 'enum' || m[1] === 'struct') sawPartial = partial(i, end) || sawPartial;
      if (m[1] === 'trait') {
        for (let j = i + 1; j <= end; j++) {
          if (doc.depth[j] !== 1) continue;
          const f = RS_FN.exec(doc.lines[j]!);
          if (f) push(f[1]!, 'method', m[2]!, j);
        }
      }
    }
  }
  return { symbols, reliable: maskedOk && doc.balanced && !sawPartial };
}

// ---- C --------------------------------------------------------------------

const C_NOT_FN = new Set(['if', 'for', 'while', 'switch', 'return', 'sizeof', 'else', 'do', 'defined']);

function scanC(text: string): ScanResult {
  const { doc, maskedOk } = prepare(text, 'c');
  const src = text.split('\n');
  const { symbols, push, partial } = collector(src, doc);
  let sawPartial = false;
  for (let i = 0; i < doc.lines.length; i++) {
    const l = doc.lines[i]!;
    let m: RegExpExecArray | null;
    if (doc.depth[i] === 0) {
      if ((m = /^\s*#\s*define\s+([A-Za-z_]\w*)/.exec(l))) {
        push(m[1]!, 'macro', null, i, i);
        continue;
      }
      if ((m = /^\s*(?:typedef\s+)?(struct|union|enum)\s+([A-Za-z_]\w*)\s*(?:\{|$)/.exec(l))) {
        const end = declEnd(doc, i);
        const isEnum = m[1] === 'enum';
        push(m[2]!, isEnum ? 'enum' : 'struct', null, i, end);
        sawPartial = partial(i, end) || sawPartial;
        for (let j = i + 1; j <= end; j++) {
          if (doc.depth[j] !== 1) continue;
          const member = isEnum ? /^\s*([A-Za-z_]\w*)\s*(?:=|,|$)/.exec(doc.lines[j]!) : /([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*(?::\s*\d+\s*)?;/.exec(doc.lines[j]!);
          if (!member) continue;
          if (isEnum) push(member[1]!, 'constant', null, j, j);
          push(member[1]!, isEnum ? 'constant' : 'field', m[2]!, j, j);
        }
        continue;
      }
      if ((m = /^\s*typedef\b.*?([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*;/.exec(l))) {
        push(m[1]!, 'type', null, i, i);
        continue;
      }
      if (/^\s*typedef\b/.test(l) && /\{\s*$/.test(l)) {
        const end = declEnd(doc, i);
        const close = /^\s*\}\s*([A-Za-z_]\w*)\s*;/.exec(doc.lines[end] ?? '');
        if (close) push(close[1]!, 'type', null, i, end);
        continue;
      }
      if ((m = /^\s*(?:(?:static|inline|extern|const|unsigned|signed|struct|enum|union|volatile|register)\s+)*[A-Za-z_][\w\s*]*?[\s*]([A-Za-z_]\w*)\s*\([^;{}]*(?:\)\s*)?\{?\s*$/.exec(l)) && !C_NOT_FN.has(m[1]!)) {
        const end = declEnd(doc, i);
        const body = doc.masked.slice(doc.offsets[i]!, doc.offsets[end]! + (doc.lines[end]?.length ?? 0));
        if (body.includes('{') && !/^\s*\w[\w\s*]*\(.*\)\s*;\s*$/.test(l)) push(m[1]!, 'function', null, i, end);
      }
    } else if (doc.depth[i] === 1 && /^\s*\}\s*([A-Za-z_]\w*)\s*;/.test(l)) {
      // `typedef struct { ... } Name;` closing line is handled when the opener is found.
    }
  }
  return { symbols, reliable: maskedOk && doc.balanced && !sawPartial };
}

// ---- registry -------------------------------------------------------------

/** The built-in regex provider; fast and dependency-free, with the accuracy limits noted in the design. */
export const builtinProvider: SymbolProvider = {
  scan(text, lang) {
    try {
      switch (lang) {
        case 'typescript':
        case 'javascript':
          return scanScript(text, lang);
        case 'python':
          return scanPython(text);
        case 'go':
          return scanGo(text);
        case 'rust':
          return scanRust(text);
        case 'c':
          return scanC(text);
      }
    } catch {
      return { symbols: [], reliable: false };
    }
  },
};

const providers = new Map<Lang, SymbolProvider>();

/** Replace the provider for one language, e.g. with a tree-sitter backed one. */
export function registerProvider(lang: Lang, provider: SymbolProvider): void {
  providers.set(lang, provider);
}

export function resetProviders(): void {
  providers.clear();
}

export function providerFor(lang: Lang): SymbolProvider {
  return providers.get(lang) ?? builtinProvider;
}

export type LookupResult =
  | { status: 'found'; symbol: CodeSymbol }
  | { status: 'absent' }
  | { status: 'unresolvable'; reason: 'unsupported-language' | 'unreadable' | 'uncertain' };

/** Scan a file's text with the registered provider for its language; null text means the file could not be read. */
export function scanFile(path: string, text: string | null): ScanResult | null {
  const lang = langOfFile(path);
  if (!lang || text === null) return null;
  return providerFor(lang).scan(text, lang);
}

/**
 * Look a symbol path up in a file: `name` for a top-level symbol, `Parent#name` for a member.
 * Absence is only reported for a file that scanned cleanly; otherwise the answer is `unresolvable`.
 */
export function lookupSymbol(path: string, text: string | null, symbolPath: string): LookupResult {
  if (!langOfFile(path)) return { status: 'unresolvable', reason: 'unsupported-language' };
  const scan = scanFile(path, text);
  if (!scan) return { status: 'unresolvable', reason: 'unreadable' };
  const parts = symbolPath.split('#');
  const hit =
    parts.length === 1
      ? scan.symbols.find((s) => s.name === parts[0] && s.parent === null)
      : parts.length === 2
        ? scan.symbols.find((s) => s.name === parts[1] && s.parent === parts[0])
        : undefined;
  if (hit) return { status: 'found', symbol: hit };
  return scan.reliable ? { status: 'absent' } : { status: 'unresolvable', reason: 'uncertain' };
}
