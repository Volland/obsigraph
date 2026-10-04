import type { ParsedEdge } from '../edges/parse.js';
import { buildCodeLayer, upsertCodeNode, type CodeLayer, type CodeMode, type CodeSource } from '../code/layer.js';
import { Graph } from '../graph/graph.js';
import type { LatIndex } from './index.js';

export interface LatGraphOptions {
  /** Code to bring into the graph; default `off`. */
  code?: { mode: CodeMode; files: CodeSource[] };
}

function edge(type: string, target: string, line: number): ParsedEdge {
  return { type, sign: 1, target, subpath: null, alias: null, props: {}, line, heading: null };
}

/**
 * The lattice as a property graph the Cypher engine can query: one `Section`
 * node per section with properties `section` (the lat id), `title`, `file`,
 * `depth`, `startLine`, `endLine` and `summary`; `contains` edges from parent to
 * child section and `references` edges for every wiki link that resolves to a
 * section or, when the code layer is on, to a code node. With code enabled,
 * `CodeFile` and `CodeSymbol` nodes and the `@lat:` and `@tg:` edges join in.
 */
// @lat: [[cli#Agent integration]]
export function buildLatGraph(index: LatIndex, options: LatGraphOptions = {}): { graph: Graph; code: CodeLayer } {
  const known = new Set<string>(index.sections().map((s) => s.id));
  const resolveSection = (target: string): string | null => {
    const r = index.resolve(target);
    return r.kind === 'section' ? r.id : null;
  };
  const code = options.code ? buildCodeLayer(options.code.files, options.code.mode, resolveSection) : { nodes: [], unresolved: [] };
  for (const n of code.nodes) known.add(n.path);

  const graph = new Graph(
    (link) => (known.has(link) ? link : null),
    (link, sub) => (known.has(`${link}#${sub}`) ? `${link}#${sub}` : null),
  );

  // Section links, including links from prose to code nodes.
  const linksBySection = new Map<string, Map<string, number>>();
  for (const ref of index.refs()) {
    if (!ref.fromSection) continue;
    const res = index.resolve(ref.target);
    let target: string | null = null;
    if (res.kind === 'section') target = res.id;
    else if (res.kind === 'code') target = known.has(res.symbol ? `${res.file}#${res.symbol}` : res.file) ? (res.symbol ? `${res.file}#${res.symbol}` : res.file) : null;
    if (!target) continue;
    const m = linksBySection.get(ref.fromSection) ?? new Map<string, number>();
    if (!m.has(target)) m.set(target, ref.line);
    linksBySection.set(ref.fromSection, m);
  }

  for (const s of index.sections()) {
    const edges: ParsedEdge[] = s.children.map((c) => edge('contains', c.id, c.startLine));
    for (const [target, line] of linksBySection.get(s.id) ?? []) if (target !== s.id) edges.push(edge('references', target, line));
    graph.upsertNote({
      path: s.id,
      text: '',
      edges,
      frontmatter: { type: 'Section', section: s.id, file: s.filePath, depth: s.depth, startLine: s.startLine, endLine: s.endLine, summary: s.firstParagraph },
    });
    // Node titles default to the last path segment, which for a section id is not the heading.
    graph.node(s.id)!.props.title = s.heading;
  }

  for (const n of code.nodes) upsertCodeNode(graph, n);
  return { graph, code };
}
