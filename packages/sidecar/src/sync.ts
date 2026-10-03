import { watch, type FSWatcher } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Graph, pathResolver, type NoteInput } from '@obsigraph/core';
import type { DataDir } from './data-dir.js';
import { isNotePath, listMarkdown, readNote } from './vault.js';

/** A downstream store fed per changed file, e.g. the Ladybug mirror or vector index. */
export interface Processor {
  name: string;
  upsert(note: NoteInput, graph: Graph): Promise<void> | void;
  remove(path: string, graph: Graph): Promise<void> | void;
}

interface FileState {
  mtimeMs: number;
  hash: string;
}

interface StoredState {
  version: 1;
  files: Record<string, FileState>;
}

export type SyncState = 'starting' | 'syncing' | 'ready';

export interface SyncStatus {
  state: SyncState;
  notes: number;
  edges: number;
  pending: number;
  lastSync: string | null;
  /** Paths handed to processors by the last reconcile; for status and tests. */
  lastReconciled: string[];
}

const STATE_FILE = 'sync-state.json';

/**
 * Keeps the core graph in sync with a vault directory: startup reconcile by
 * content hash, debounced watching with a polling fallback, and per-file
 * hand-off to processors. Never writes to the vault.
 */
// @lat: [[sidecar#Shared core]]
export class VaultSync {
  readonly graph: Graph;
  private readonly known = new Set<string>();
  private files = new Map<string, FileState>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly inflight = new Set<Promise<void>>();
  private watcher: FSWatcher | null = null;
  private poller: NodeJS.Timeout | null = null;
  private catchUp: NodeJS.Timeout | null = null;
  private state: SyncState = 'starting';
  private lastSync: Date | null = null;
  private lastReconciled: string[] = [];
  readonly frontmatterErrors = new Map<string, string>();

  constructor(
    private readonly vaultDir: string,
    private readonly data: DataDir,
    private readonly processors: Processor[] = [],
    private readonly opts: { debounceMs: number; pollMs: number } = { debounceMs: 300, pollMs: 0 },
  ) {
    this.graph = new Graph(pathResolver(() => this.known));
  }

  status(): SyncStatus {
    const { nodes, edges } = this.graph.size;
    const stubs = [...this.graph.nodes()].filter((n) => n.stub).length;
    return {
      state: this.state,
      notes: nodes - stubs,
      edges,
      pending: this.timers.size + this.inflight.size,
      lastSync: this.lastSync?.toISOString() ?? null,
      lastReconciled: this.lastReconciled,
    };
  }

  /**
   * Build the graph from every note, then hand only new or changed files
   * (by content hash against stored state) and deleted files to processors.
   */
  async start(): Promise<void> {
    this.state = 'syncing';
    const stored = (await this.data.readJson<StoredState>(STATE_FILE))?.files ?? {};
    const listing = await listMarkdown(this.vaultDir);
    for (const f of listing) this.known.add(f.path);

    const changed: NoteInput[] = [];
    const next = new Map<string, FileState>();
    for (const f of listing) {
      const r = await this.load(f.path);
      if (!r) continue;
      next.set(f.path, { mtimeMs: f.mtimeMs, hash: r.hash });
      if (stored[f.path]?.hash !== r.hash) changed.push(r.note);
    }
    const removed = Object.keys(stored).filter((p) => !next.has(p));
    this.files = next;

    for (const note of changed) for (const p of this.processors) await p.upsert(note, this.graph);
    for (const path of removed) for (const p of this.processors) await p.remove(path, this.graph);
    this.lastReconciled = [...changed.map((n) => n.path), ...removed];
    await this.persist();
    this.state = 'ready';
    this.lastSync = new Date();
  }

  /** Watch for changes; uses native events and, when configured, polling. */
  watch(): void {
    try {
      this.watcher = watch(this.vaultDir, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const path = filename.toString().split('\\').join('/');
        if (isNotePath(path)) this.schedule(path);
      });
      this.watcher.on('error', () => {
        this.watcher?.close();
        this.watcher = null;
      });
    } catch {
      this.watcher = null;
    }
    if (this.opts.pollMs > 0) this.poller = setInterval(() => void this.poll(), this.opts.pollMs);
    // Native watchers start asynchronously; one catch-up scan covers edits made
    // between the initial listing and the watcher becoming active.
    this.catchUp = setTimeout(() => void this.poll(), Math.max(this.opts.debounceMs, 100));
  }

  async stop(): Promise<void> {
    this.watcher?.close();
    if (this.poller) clearInterval(this.poller);
    if (this.catchUp) clearTimeout(this.catchUp);
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    await Promise.all(this.inflight);
  }

  /** Resolve once no change is pending or being processed. */
  async idle(): Promise<void> {
    while (this.timers.size > 0 || this.inflight.size > 0) {
      await Promise.all(this.inflight);
      if (this.timers.size > 0) await new Promise((r) => setTimeout(r, 10));
    }
  }

  /** Coalesce bursts: one processing run per file after the debounce interval. */
  private schedule(path: string): void {
    const prev = this.timers.get(path);
    if (prev) clearTimeout(prev);
    this.timers.set(
      path,
      setTimeout(() => {
        this.timers.delete(path);
        const job = this.process(path).finally(() => this.inflight.delete(job));
        this.inflight.add(job);
      }, this.opts.debounceMs),
    );
  }

  private async poll(): Promise<void> {
    const listing = await listMarkdown(this.vaultDir).catch(() => null);
    if (!listing) return;
    const seen = new Set<string>();
    for (const f of listing) {
      seen.add(f.path);
      if (this.files.get(f.path)?.mtimeMs !== f.mtimeMs) this.schedule(f.path);
    }
    for (const path of this.files.keys()) if (!seen.has(path)) this.schedule(path);
  }

  private async process(path: string): Promise<void> {
    const exists = await stat(join(this.vaultDir, ...path.split('/'))).then((s) => s.isFile(), () => false);
    if (!exists) {
      if (!this.files.has(path)) return;
      this.known.delete(path);
      this.files.delete(path);
      this.frontmatterErrors.delete(path);
      this.graph.removeNote(path);
      for (const p of this.processors) await p.remove(path, this.graph);
    } else {
      this.known.add(path);
      const s = await stat(join(this.vaultDir, ...path.split('/')));
      const r = await this.load(path);
      if (!r) return;
      const unchanged = this.files.get(path)?.hash === r.hash;
      this.files.set(path, { mtimeMs: s.mtimeMs, hash: r.hash });
      if (unchanged) return;
      for (const p of this.processors) await p.upsert(r.note, this.graph);
    }
    this.lastSync = new Date();
    await this.persist();
  }

  private async load(path: string) {
    try {
      const r = await readNote(this.vaultDir, path);
      if (r.frontmatterError) this.frontmatterErrors.set(path, r.frontmatterError);
      else this.frontmatterErrors.delete(path);
      this.graph.upsertNote(r.note);
      return r;
    } catch {
      return null;
    }
  }

  private persist(): Promise<void> {
    return this.data.writeJson(STATE_FILE, { version: 1, files: Object.fromEntries(this.files) } satisfies StoredState);
  }
}
