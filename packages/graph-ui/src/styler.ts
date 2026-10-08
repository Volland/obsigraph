import { nodeLabelText, resolveEdgeStyle, resolveNodeStyle, type ResolvedEdgeStyle, type ResolvedNodeStyle, type StyleSource } from '@obsigraph/core';
import type { EdgeElement, NodeElement } from './elements';

export interface NodeVisual {
  color: string;
  shape: string;
  label: string;
  /** Image URI for the icon, or empty when none. */
  icon: string;
}

export interface EdgeVisual {
  color: string;
  line: string;
}

/** Turns elements into visual data for the renderer, from sources in precedence order. */
export interface Styler {
  readonly sources: StyleSource[];
  node(n: NodeElement): NodeVisual;
  edge(e: EdgeElement): EdgeVisual;
  resolveNode(labels: string[]): ResolvedNodeStyle;
  resolveEdge(type: string, sign: 1 | -1): ResolvedEdgeStyle;
}

/**
 * @param sources highest precedence first: block header, schema notes, settings
 * @param iconUri maps an icon name to an image URI, or null when unavailable
 */
// @lat: [[visualization#Styling]]
// @tg: implements:: [[openspec:graph-view#Node type styling]]
export function makeStyler(sources: StyleSource[], iconUri: (name: string) => string | null = () => null): Styler {
  return {
    sources,
    resolveNode: (labels) => resolveNodeStyle(labels, sources),
    resolveEdge: (type, sign) => resolveEdgeStyle(type, sign, sources),
    node(n) {
      const s = resolveNodeStyle(n.labels, sources);
      return {
        color: s.color,
        shape: s.shape,
        label: nodeLabelText(n.props, n.label, s.label),
        icon: s.icon ? (iconUri(s.icon) ?? '') : '',
      };
    },
    edge(e) {
      const s = resolveEdgeStyle(e.type, e.sign, sources);
      return { color: s.color, line: s.line };
    },
  };
}
