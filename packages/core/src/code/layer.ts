import type { ParsedEdge } from '../edges/parse.js';
import type { Graph } from '../graph/graph.js';
import { isSourceTarget, splitTarget } from '../latmd/links.js';
import { scanAnnotations, type Annotation } from './annotations.js';
import { langOfFile, scanFile, type CodeSymbol } from './symbols.js';

/** How much code enters the graph: nothing, only annotated symbols (and what they point at), or every symbol. */
export type CodeMode = 'off' | 'annotated' | 'all';

export interface CodeSource {
  /** Project-relative posix path. */
  path: string;
  text: string;
}

/** One derived node, ready for `Graph.upsertNote` (empty text, pre-parsed edges). */
export interface CodeNode {
  path: string;
  frontmatter: Record<string, unknown>;
  edges: ParsedEdge[];
}

export interface CodeLayer {
  nodes: CodeNode[];
  /** Annotation targets that resolved to nothing, with where they were written. */
  unresolved: { file: string; line: number; target: string }[];
}

/** Node key of a symbol: `path#Class#method`, the same text a `[[path#symbol]]` link carries. */
export function symbolKey(file: string, symbolPath: string): string {
  return `${file}#${symbolPath}`;
}

const pathOf = (s: CodeSymbol): string => (s.parent ? `${s.parent}#${s.name}` : s.name);

function edge(type: string, sign: 1 | -1, target: string, props: ParsedEdge['props'], line: number): ParsedEdge {
  return { type, sign, target, subpath: null, alias: null, props, line, heading: null };
}

/**
 * Derive `CodeFile` and `CodeSymbol` nodes with `contains` edges and the
 * annotation edges written in comments. `resolveTarget` maps a non-code link
 * target (e.g. `auth#Login`) to the node key it should point at, or null.
 */
// @lat: [[cli#Code layer]]
export function buildCodeLayer(files: CodeSource[], mode: CodeMode, resolveTarget: (target: string, sourceFile: string) => string | null): CodeLayer {
  if (mode === 'off') return { nodes: [], unresolved: [] };
  interface Scanned {
    file: CodeSource;
    symbols: CodeSymbol[];
    annotations: Annotation[];
  }
  const scanned = new Map<string, Scanned>();
  for (const f of files) {
    if (!langOfFile(f.path)) continue;
    scanned.set(f.path, { file: f, symbols: scanFile(f.path, f.text)?.symbols ?? [], annotations: scanAnnotations(f.path, f.text).annotations });
  }

  // Which symbols and files get nodes.
  const wantFile = new Set<string>();
  const wantSymbol = new Set<string>(); // symbolKey
  const codeTarget = (target: string): { file: string; symbol: string } | null => {
    if (!isSourceTarget(target)) return null;
    const { file, rest } = splitTarget(target);
    return rest && scanned.has(file) ? { file, symbol: rest } : null;
  };
  for (const [path, sc] of scanned) {
    if (mode === 'all') {
      wantFile.add(path);
      for (const s of sc.symbols) wantSymbol.add(symbolKey(path, pathOf(s)));
      continue;
    }
    for (const a of sc.annotations) {
      wantFile.add(path);
      if (a.source.kind === 'symbol') wantSymbol.add(symbolKey(path, a.source.symbolPath));
      for (const e of a.edges) {
        const ct = codeTarget(e.target);
        if (ct) {
          wantFile.add(ct.file);
          wantSymbol.add(symbolKey(ct.file, ct.symbol));
        }
      }
    }
  }

  // A wanted member brings its class along, so `contains` edges always have a source.
  for (const key of [...wantSymbol]) {
    const { file, rest } = splitTarget(key);
    const sym = scanned.get(file)?.symbols.find((s) => pathOf(s) === rest);
    if (sym?.parent) wantSymbol.add(symbolKey(file, sym.parent));
  }

  const nodes = new Map<string, CodeNode>();
  const unresolved: CodeLayer['unresolved'] = [];
  for (const path of wantFile) {
    const sc = scanned.get(path);
    if (!sc) continue;
    nodes.set(path, { path, frontmatter: { type: 'CodeFile', lang: langOfFile(path), lines: sc.file.text.split('\n').length }, edges: [] });
  }
  for (const key of wantSymbol) {
    const { file, rest } = splitTarget(key);
    const sc = scanned.get(file);
    const sym = sc?.symbols.find((s) => pathOf(s) === rest);
    if (!sc || !sym) continue;
    nodes.set(key, {
      path: key,
      frontmatter: { type: 'CodeSymbol', name: sym.name, kind: sym.kind, lang: langOfFile(file), path: file, symbol: rest, lines: `${sym.startLine}-${sym.endLine}`, startLine: sym.startLine, endLine: sym.endLine, signature: sym.signature },
      edges: [],
    });
    // The file contains top-level symbols, a class its members.
    const parent = sym.parent ? symbolKey(file, sym.parent) : file;
    nodes.get(parent)?.edges.push(edge('contains', 1, key, {}, sym.startLine));
  }

  // Annotation edges.
  for (const sc of scanned.values()) {
    for (const a of sc.annotations) {
      const from = a.source.kind === 'symbol' ? symbolKey(a.file, a.source.symbolPath) : a.file;
      const node = nodes.get(from);
      if (!node) continue;
      for (const e of a.edges) {
        const ct = codeTarget(e.target);
        const target = ct ? (nodes.has(symbolKey(ct.file, ct.symbol)) ? symbolKey(ct.file, ct.symbol) : null) : resolveTarget(e.target, a.file);
        if (!target) {
          unresolved.push({ file: a.file, line: a.line, target: e.target });
          continue;
        }
        node.edges.push(edge(e.type, e.sign, target, e.props, a.line));
      }
    }
  }
  return { nodes: [...nodes.values()], unresolved };
}

/** Add one derived node to a graph; node `path` is the code file (the graph key is the node id) and `title` the symbol or file name. */
export function upsertCodeNode(graph: Graph, n: CodeNode): void {
  graph.upsertNote({ path: n.path, text: '', frontmatter: n.frontmatter, edges: n.edges });
  const node = graph.node(n.path);
  if (!node) return;
  node.props.path = typeof n.frontmatter.path === 'string' ? n.frontmatter.path : n.path;
  node.props.title = typeof n.frontmatter.name === 'string' ? n.frontmatter.name : n.path.slice(n.path.lastIndexOf('/') + 1);
}
