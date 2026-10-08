import { titleOf, type Graph, type GraphEdge } from '@obsigraph/core';
import type { WorkspaceIndex } from './workspace-index';

export interface BacklinkItem {
  /** Workspace-relative path to open. */
  path: string;
  /** 1-based line to reveal (graph edges count from 0, converted here). */
  line: number;
  label: string;
  /** Edge sign; null for code references. */
  sign: 1 | -1 | null;
  props: Record<string, unknown>;
  /** The link as written in code, e.g. `architecture#Monorepo layout`. */
  target?: string;
}

export interface BacklinkGroup {
  /** Edge type, or `referenced from code` / `describes` for code layer groups. */
  title: string;
  items: BacklinkItem[];
}

export interface Backlinks {
  kind: 'note' | 'source' | 'empty';
  groups: BacklinkGroup[];
}

const EMPTY: Backlinks = { kind: 'empty', groups: [] };

function fromEdge(e: GraphEdge, graph: Graph): BacklinkItem {
  const src = graph.node(e.source);
  return { path: e.source, line: e.line + 1, label: src && !src.stub ? titleOf(e.source) : e.source, sign: e.sign, props: e.props };
}

/**
 * Typed backlinks for the active file. A note lists incoming edges grouped by
 * type, plus the source files that annotate it; a source file lists the notes
 * its annotations point at. Whole-file granularity.
 */
// @lat: [[vscode#Backlinks]]
// @tg: implements:: [[openspec:vscode-extension#Backlinks for source files]]
// @tg: implements:: [[openspec:vscode-extension#Empty and unsupported states]]
// @tg: implements:: [[openspec:vscode-extension#Typed backlinks for notes]]
export function backlinksFor(index: WorkspaceIndex, path: string): Backlinks {
  const graph = index.graph;
  if (index.isSource(path)) {
    const items: BacklinkItem[] = [];
    for (const a of index.annotationsIn(path)) {
      for (const e of a.edges) {
        const file = e.target.split('#')[0]!;
        const resolved = graph.resolveLink(file, path);
        if (resolved && !index.isNote(resolved)) continue;
        items.push({ path: resolved ?? file, line: 1, label: e.target, sign: e.sign, props: e.props, target: e.target });
      }
    }
    return items.length ? { kind: 'source', groups: [{ title: 'describes', items }] } : EMPTY;
  }
  if (!index.isNote(path)) return EMPTY;

  const byType = new Map<string, BacklinkItem[]>();
  for (const e of graph.inEdges(path)) {
    // Code-layer edges are shown from the annotation index, with the written link.
    if (!index.isNote(e.source)) continue;
    const list = byType.get(e.type) ?? [];
    list.push(fromEdge(e, graph));
    byType.set(e.type, list);
  }
  const groups: BacklinkGroup[] = [...byType].sort(([a], [b]) => a.localeCompare(b)).map(([title, items]) => ({ title, items: items.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line) }));
  const code = index.annotationsTargeting(path).map((r): BacklinkItem => ({ path: r.file, line: r.line, label: r.file, sign: null, props: {}, target: r.target }));
  if (code.length) groups.push({ title: 'referenced from code', items: code.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line) });
  return groups.length ? { kind: 'note', groups } : EMPTY;
}

/** One row of the Backlinks view: a short message, an edge group, or the setup offer. */
export type PanelRow = { kind: 'message'; text: string } | { kind: 'group'; group: BacklinkGroup } | { kind: 'setup' };

/** The active editor's file: a workspace-relative path, or any path with `inWorkspace` false. */
export interface ActiveFile {
  path: string;
  inWorkspace: boolean;
}

/**
 * The top-level rows of the Backlinks view. A file outside `typegraph.roots`
 * gets its own message. While setup is needed the offer is appended as a row,
 * except with no active file, where no rows are returned so VS Code shows the
 * welcome content with its "Set up TypeGraph" link.
 */
// @tg: implements:: [[openspec:vscode-extension#Empty and unsupported states]]
// @tg: implements:: [[openspec:vscode-extension#Set up TypeGraph]]
export function panelRows(index: WorkspaceIndex, file: ActiveFile | null, needsSetup: boolean): PanelRow[] {
  if (!file) return needsSetup ? [] : [{ kind: 'message', text: 'Open a markdown or source file.' }];
  const name = file.path.split(/[\\/]/).pop() ?? file.path;
  let rows: PanelRow[];
  if (!file.inWorkspace || !index.accepts(file.path)) rows = [{ kind: 'message', text: `${name} is outside the configured roots (typegraph.roots).` }];
  else {
    const r = backlinksFor(index, file.path);
    rows = r.kind === 'empty' ? [{ kind: 'message', text: `No typed edges for ${name}.` }] : r.groups.map((group) => ({ kind: 'group', group }));
  }
  return needsSetup ? [...rows, { kind: 'setup' }] : rows;
}
