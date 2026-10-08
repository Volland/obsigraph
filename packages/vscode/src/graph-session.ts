import { mergeElements, neighborhood, type GraphElements } from '@obsigraph/graph-ui';
import type { Graph } from '@obsigraph/core';

/**
 * What the graph webview shows: the active file's neighborhood plus the
 * neighborhoods of nodes the user expanded. Expansions survive refreshes of
 * the same file and are cleared when the active file changes, as in Obsidian.
 * With no active file (focus in the webview itself) the last file is kept.
 */
// @lat: [[vscode#Graph webview]]
// @tg: implements:: [[openspec:vscode-extension#Graph webview]]
export class GraphSession {
  private readonly expanded = new Set<string>();
  private current: string | null = null;

  constructor(private readonly graph: () => Graph) {}

  expand(id: string): void {
    this.expanded.add(id);
  }

  elements(active: string | null): GraphElements {
    if (active && active !== this.current) {
      this.expanded.clear();
      this.current = active;
    }
    const focus = active ?? this.current;
    const g = this.graph();
    const sets: GraphElements[] = focus ? [neighborhood(g, focus)] : [];
    for (const id of this.expanded) if (g.node(id)) sets.push(neighborhood(g, id));
    return mergeElements(...sets);
  }
}
