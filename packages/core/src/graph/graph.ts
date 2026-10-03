import { parseEdges, type Diagnostic, type ParsedEdge, type Sign } from '../edges/parse.js';
import type { Props } from '../edges/props.js';

export interface GraphNode {
  /** Note path for real nodes, link text for stubs. */
  id: string;
  labels: string[];
  props: Record<string, unknown>;
  stub: boolean;
}

export interface GraphEdge {
  id: string;
  type: string;
  sign: Sign;
  source: string;
  target: string;
  props: Props;
  heading: string | null;
  line: number;
}

export interface NoteInput {
  path: string;
  text: string;
  frontmatter?: Record<string, unknown> | null;
}

/** Resolve link text written in `sourcePath` to an existing note path, or null. */
export type LinkResolver = (link: string, sourcePath: string) => string | null;

interface FileState {
  parsed: ParsedEdge[];
  diagnostics: Diagnostic[];
  edgeIds: string[];
}

/**
 * In-memory property graph: one node per note, stub nodes for unresolved
 * links, typed edges with derived or pinned IDs. Updates are per file.
 */
// @lat: [[graph-model]]
export class Graph {
  private readonly nodeMap = new Map<string, GraphNode>();
  private readonly edgeMap = new Map<string, GraphEdge>();
  private readonly files = new Map<string, FileState>();
  private readonly out = new Map<string, Set<string>>();
  private readonly in = new Map<string, Set<string>>();
  /** Target node id -> source paths with at least one edge to it. */
  private readonly incoming = new Map<string, Set<string>>();
  private readonly stubRefs = new Map<string, number>();
  private readonly listeners = new Set<(paths: string[]) => void>();

  constructor(private readonly resolve: LinkResolver) {}

  // ---- queries -----------------------------------------------------------

  get size(): { nodes: number; edges: number } {
    return { nodes: this.nodeMap.size, edges: this.edgeMap.size };
  }
  nodes(): IterableIterator<GraphNode> {
    return this.nodeMap.values();
  }
  edges(): IterableIterator<GraphEdge> {
    return this.edgeMap.values();
  }
  node(id: string): GraphNode | undefined {
    return this.nodeMap.get(id);
  }
  edge(id: string): GraphEdge | undefined {
    return this.edgeMap.get(id);
  }
  outEdges(nodeId: string): GraphEdge[] {
    return [...(this.out.get(nodeId) ?? [])].map((id) => this.edgeMap.get(id)!);
  }
  inEdges(nodeId: string): GraphEdge[] {
    return [...(this.in.get(nodeId) ?? [])].map((id) => this.edgeMap.get(id)!);
  }
  /** Resolve link text written in `sourcePath` to a node id (real note or existing stub). */
  resolveLink(link: string, sourcePath: string): string | null {
    const target = link.trim();
    const resolved = this.resolve(target, sourcePath);
    if (resolved && this.nodeMap.has(resolved)) return resolved;
    const stub = target.replace(/\.md$/, '');
    return this.nodeMap.get(stub)?.stub ? stub : null;
  }

  diagnostics(): Diagnostic[] {
    return [...this.files.values()].flatMap((f) => f.diagnostics);
  }

  /** Subscribe to change notifications; returns an unsubscribe function. */
  onChange(fn: (paths: string[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---- updates -----------------------------------------------------------

  /** Add or replace a note and its outgoing edges. */
  // @lat: [[graph-model#Nodes]]
  upsertNote(note: NoteInput): void {
    const isNew = !this.files.has(note.path);
    this.dropEdges(note.path);
    this.nodeMap.set(note.path, {
      id: note.path,
      labels: labelsOf(note.frontmatter),
      props: { ...(note.frontmatter ?? {}), path: note.path, title: titleOf(note.path) },
      stub: false,
    });
    const { edges, diagnostics } = parseEdges(note.text, note.path);
    this.files.set(note.path, { parsed: edges, diagnostics, edgeIds: [] });
    this.addEdges(note.path);

    const touched = new Set([note.path]);
    // A new note may satisfy links that were stubs before.
    if (isNew) this.reresolve(this.sourcesOfStubs(), touched);
    this.emit(touched);
  }

  removeNote(path: string): void {
    if (!this.files.has(path)) return;
    this.dropEdges(path);
    this.files.delete(path);
    this.nodeMap.delete(path);
    const touched = new Set([path]);
    // Edges that pointed at the removed note now resolve to stubs.
    this.reresolve(new Set(this.incoming.get(path) ?? []), touched);
    this.emit(touched);
  }

  renameNote(oldPath: string, note: NoteInput): void {
    this.removeNote(oldPath);
    this.upsertNote(note);
  }

  // ---- internals ---------------------------------------------------------

  private sourcesOfStubs(): Set<string> {
    const out = new Set<string>();
    for (const stub of this.stubRefs.keys()) for (const s of this.incoming.get(stub) ?? []) out.add(s);
    return out;
  }

  private reresolve(sources: Set<string>, touched: Set<string>): void {
    for (const src of sources) {
      if (!this.files.has(src)) continue;
      this.dropEdges(src);
      this.addEdges(src);
      touched.add(src);
    }
  }

  // @lat: [[edge-syntax#Edge identity]]
  private addEdges(path: string): void {
    const file = this.files.get(path)!;
    const ordinals = new Map<string, number>();
    for (const p of file.parsed) {
      const resolved = this.resolve(p.target, path);
      const target = resolved ?? this.ensureStub(p.target);
      const key = `${path}#${p.type}#${target}`;
      const n = ordinals.get(key) ?? 0;
      ordinals.set(key, n + 1);
      const pinned = p.props.id;
      const id = typeof pinned === 'string' || typeof pinned === 'number' ? String(pinned) : `${key}#${n}`;
      const edge: GraphEdge = {
        id,
        type: p.type,
        sign: p.sign,
        source: path,
        target,
        props: p.props,
        heading: p.heading,
        line: p.line,
      };
      if (this.edgeMap.has(id)) {
        file.diagnostics.push({ path, line: p.line, column: 0, message: `Duplicate edge id '${id}' ignored` });
        if (!resolved) this.releaseStub(target);
        continue;
      }
      this.edgeMap.set(id, edge);
      file.edgeIds.push(id);
      setAdd(this.out, path, id);
      setAdd(this.in, target, id);
      setAdd(this.incoming, target, path);
    }
  }

  private dropEdges(path: string): void {
    const file = this.files.get(path);
    if (!file) return;
    // Diagnostics added during edge building (duplicate ids) are rebuilt with the edges.
    file.diagnostics = file.diagnostics.filter((d) => !d.message.startsWith('Duplicate edge id'));
    for (const id of file.edgeIds) {
      const e = this.edgeMap.get(id);
      if (!e) continue;
      this.edgeMap.delete(id);
      setDel(this.out, e.source, id);
      setDel(this.in, e.target, id);
      setDel(this.incoming, e.target, path);
      if (this.stubRefs.has(e.target)) this.releaseStub(e.target);
    }
    file.edgeIds = [];
  }

  // @lat: [[graph-model#Nodes]]
  private ensureStub(link: string): string {
    const id = link.replace(/\.md$/, '');
    this.stubRefs.set(id, (this.stubRefs.get(id) ?? 0) + 1);
    if (!this.nodeMap.has(id)) {
      this.nodeMap.set(id, { id, labels: [], props: { title: titleOf(id), path: null }, stub: true });
    }
    return id;
  }

  private releaseStub(id: string): void {
    const n = (this.stubRefs.get(id) ?? 0) - 1;
    if (n > 0) {
      this.stubRefs.set(id, n);
      return;
    }
    this.stubRefs.delete(id);
    if (this.nodeMap.get(id)?.stub) this.nodeMap.delete(id);
  }

  private emit(paths: Set<string>): void {
    const list = [...paths];
    for (const fn of this.listeners) fn(list);
  }
}

// @lat: [[graph-model#Node types]]
export function labelsOf(frontmatter: Record<string, unknown> | null | undefined): string[] {
  const t = frontmatter?.type;
  const raw = Array.isArray(t) ? t : t == null ? [] : [t];
  return [...new Set(raw.filter((x): x is string | number => typeof x === 'string' || typeof x === 'number').map(String).map((s) => s.trim()).filter(Boolean))];
}

export function titleOf(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base.replace(/\.md$/, '');
}

function setAdd<K, V>(m: Map<K, Set<V>>, k: K, v: V): void {
  let s = m.get(k);
  if (!s) m.set(k, (s = new Set()));
  s.add(v);
}
function setDel<K, V>(m: Map<K, Set<V>>, k: K, v: V): void {
  const s = m.get(k);
  if (!s) return;
  s.delete(v);
  if (s.size === 0) m.delete(k);
}
