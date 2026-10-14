import { mergeElements, neighborhood, projectElements, type GraphElements } from '@obsigraph/graph-ui';
import type { Graph } from '@obsigraph/core';

export type GraphScope = 'file' | 'project';

export interface SessionView {
  elements: GraphElements;
  scope: GraphScope;
  /** Nodes in the graph; only set in the project scope. */
  total: number;
  /** Nodes the project scope left out because of the limit. */
  omitted: number;
  limit: number;
}

/**
 * What the graph webview shows. In the "file" scope: the active file's neighborhood plus the
 * neighborhoods of nodes the user expanded; expansions survive refreshes of the same file and
 * are cleared when the active file changes, as in Obsidian. With no active file (focus in the
 * webview itself) the last file is kept. In the "project" scope: every node and edge, capped
 * at the limit, regardless of the active file.
 */
// @lat: [[vscode#Graph webview]]
// @tg: implements:: [[openspec:vscode-extension#Graph webview]]
// @tg: implements:: [[openspec:vscode-extension#Whole project graph]]
export class GraphSession {
  private readonly expanded = new Set<string>();
  private current: string | null = null;
  private mode: GraphScope = 'file';

  constructor(
    private readonly graph: () => Graph,
    private readonly limit: () => number = () => 2000,
  ) {}

  get scope(): GraphScope {
    return this.mode;
  }

  setScope(scope: GraphScope): void {
    if (scope !== this.mode) this.expanded.clear();
    this.mode = scope;
  }

  expand(id: string): void {
    this.expanded.add(id);
  }

  elements(active: string | null): GraphElements {
    return this.view(active).elements;
  }

  view(active: string | null): SessionView {
    const limit = this.limit();
    if (this.mode === 'project') {
      const p = projectElements(this.graph(), limit);
      return { elements: p.elements, scope: 'project', total: p.total, omitted: p.omitted, limit };
    }
    if (active && active !== this.current) {
      this.expanded.clear();
      this.current = active;
    }
    const focus = active ?? this.current;
    const g = this.graph();
    const sets: GraphElements[] = focus ? [neighborhood(g, focus)] : [];
    for (const id of this.expanded) if (g.node(id)) sets.push(neighborhood(g, id));
    return { elements: mergeElements(...sets), scope: 'file', total: 0, omitted: 0, limit };
  }
}
