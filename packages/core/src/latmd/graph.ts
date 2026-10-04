import { Graph } from '../graph/graph.js';
import type { LatIndex } from './index.js';

/** Graph node key for a section id: `#` and link-breaking characters are replaced so edge lines can carry it. */
export function sectionKey(id: string): string {
  return id.replace(/#/g, '›').replace(/[\]|]/g, '_');
}

/**
 * The lattice as a property graph the Cypher engine can query: one `Section`
 * node per section with properties `section` (the lat id), `title`, `file`,
 * `depth`, `startLine`, `endLine` and `summary`; `contains` edges from parent to
 * child section and `references` edges for every wiki link that resolves to a
 * section.
 */
// @lat: [[cli#Agent integration]]
export function buildLatGraph(index: LatIndex): Graph {
  const keys = new Set(index.sections().map((s) => sectionKey(s.id)));
  const graph = new Graph((link) => (keys.has(link) ? link : null));
  const linksBySection = new Map<string, Set<string>>();
  for (const ref of index.refs()) {
    const res = index.resolve(ref.target);
    if (res.kind !== 'section' || !ref.fromSection) continue;
    const set = linksBySection.get(ref.fromSection) ?? new Set<string>();
    set.add(res.id);
    linksBySection.set(ref.fromSection, set);
  }
  for (const s of index.sections()) {
    const lines: string[] = [];
    for (const child of s.children) lines.push(`contains:: [[${sectionKey(child.id)}]]`);
    for (const target of linksBySection.get(s.id) ?? []) if (target !== s.id) lines.push(`references:: [[${sectionKey(target)}]]`);
    const key = sectionKey(s.id);
    graph.upsertNote({
      path: key,
      text: lines.join('\n'),
      frontmatter: { type: 'Section', section: s.id, file: s.filePath, depth: s.depth, startLine: s.startLine, endLine: s.endLine, summary: s.firstParagraph },
    });
    // Node titles default to the last path segment, which for a section key is not the heading.
    graph.node(key)!.props.title = s.heading;
  }
  return graph;
}
