import type { Graph } from '@obsigraph/core';
import type { DataDir } from '../data-dir.js';
import type { Processor } from '../sync.js';
import { applyToState, diffMirror, graphRows, isEmptyDiff, type MirrorState } from './rows.js';
import type { MirrorStore } from './store.js';

/** Bump when the storage layout changes; a mismatch triggers a rebuild. */
export const MIRROR_FORMAT = 2;
const MANIFEST = 'ladybug/manifest.json';

interface Manifest {
  format: number;
  state: 'in-progress' | 'complete';
}

export type MirrorState_ = 'disabled' | 'unavailable' | 'idle' | 'syncing' | 'failed';

export interface MirrorStatus {
  state: MirrorState_;
  message: string | null;
  nodes: number;
  edges: number;
  lastSync: string | null;
  rebuilds: number;
}

/**
 * One-way, disposable mirror of the graph. Each sync diffs the whole graph
 * against stored signatures and applies the difference in one transaction,
 * so incremental sync always equals a rebuild. Never touches notes.
 */
// @lat: [[ladybug-mirror#One-way mirror]]
export class LadybugMirror implements Processor {
  readonly name = 'ladybug-mirror';
  private graph: Graph | null = null;
  private state: MirrorState | null = null;
  private running: Promise<void> | null = null;
  private dirty = false;
  private readonly st: MirrorStatus = { state: 'idle', message: null, nodes: 0, edges: 0, lastSync: null, rebuilds: 0 };
  /** Increments after every successful sync; readers reopen snapshots when it changes. */
  version = 0;
  /** True once the mirror fully matches the graph at least once since open. */
  ready = false;

  constructor(
    readonly store: MirrorStore,
    private readonly data: DataDir,
  ) {}

  status(): MirrorStatus {
    return { ...this.st };
  }

  /** Load mirrored state, rebuilding when the manifest is missing, stale or interrupted. */
  async open(): Promise<void> {
    const m = await this.data.readJson<Manifest>(MANIFEST);
    if (!m || m.format !== MIRROR_FORMAT || m.state !== 'complete') {
      await this.store.reset();
      this.st.rebuilds++;
    }
    this.state = await this.store.load();
  }

  /** Start mirroring a graph; schedules an initial sync in the background. */
  attach(graph: Graph): void {
    this.graph = graph;
    this.schedule();
  }

  upsert(_note: unknown, graph: Graph): void {
    this.graph ??= graph;
    this.schedule();
  }

  remove(_path: string, graph: Graph): void {
    this.graph ??= graph;
    this.schedule();
  }

  /** Drop the mirror and rebuild it from the graph. */
  async rebuild(): Promise<void> {
    await this.idle();
    await this.data.writeJson(MANIFEST, { format: MIRROR_FORMAT, state: 'in-progress' } satisfies Manifest);
    await this.store.reset();
    this.st.rebuilds++;
    this.state = await this.store.load();
    this.schedule();
    await this.idle();
  }

  /** Resolve when no sync is running or queued. */
  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  private schedule(): void {
    if (!this.graph || !this.state) return;
    if (this.running) {
      this.dirty = true;
      return;
    }
    this.running = this.loop().finally(() => {
      this.running = null;
    });
  }

  private async loop(): Promise<void> {
    do {
      this.dirty = false;
      // Let queued file events land so one sync covers a burst.
      await new Promise((r) => setImmediate(r));
      await this.syncOnce();
    } while (this.dirty && this.st.state !== 'failed');
  }

  private async syncOnce(): Promise<void> {
    const graph = this.graph!;
    const state = this.state!;
    const diff = diffMirror(state, graphRows(graph));
    if (isEmptyDiff(diff)) {
      if (this.st.state !== 'failed') {
        this.st.state = 'idle';
        this.ready = true;
      }
      this.counts();
      return;
    }
    this.st.state = 'syncing';
    try {
      await this.data.writeJson(MANIFEST, { format: MIRROR_FORMAT, state: 'in-progress' } satisfies Manifest);
      await this.store.apply(diff);
      applyToState(state, diff);
      await this.data.writeJson(MANIFEST, { format: MIRROR_FORMAT, state: 'complete' } satisfies Manifest);
      this.st.state = 'idle';
      this.st.message = null;
      this.st.lastSync = new Date().toISOString();
      this.version++;
      this.ready = true;
    } catch (e) {
      // The manifest stays "in-progress", so the next open rebuilds.
      this.st.state = 'failed';
      this.st.message = (e as Error).message;
    }
    this.counts();
  }

  private counts(): void {
    this.st.nodes = this.state?.nodes.size ?? 0;
    this.st.edges = this.state?.edges.size ?? 0;
  }
}
