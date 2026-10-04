import { mergeElements, neighborhood, type GraphElements } from '@obsigraph/graph-ui';
import type { Graph } from '@obsigraph/core';

/**
 * What the graph webview shows: the active file's neighborhood plus the
 * neighborhoods of nodes the user expanded, which survive refreshes.
 */
// @lat: [[vscode#Graph webview]]
export class GraphSession {
  private readonly expanded = new Set<string>();

  constructor(private readonly graph: () => Graph) {}

  expand(id: string): void {
    this.expanded.add(id);
  }

  elements(active: string | null): GraphElements {
    const g = this.graph();
    const sets: GraphElements[] = active ? [neighborhood(g, active)] : [];
    for (const id of this.expanded) if (g.node(id)) sets.push(neighborhood(g, id));
    return mergeElements(...sets);
  }
}
