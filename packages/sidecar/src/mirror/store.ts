import { mkdir, rm } from 'node:fs/promises';
import type { DataDir } from '../data-dir.js';
import { emptyState, relTable, typeOfTable, type EdgeRow, type MirrorDiff, type MirrorState, type NodeRow } from './rows.js';

/** Where mirror rows live; LadybugDB in production, memory in tests. */
export interface MirrorStore {
  load(): Promise<MirrorState>;
  apply(diff: MirrorDiff): Promise<void>;
  /** Drop everything; the next sync rebuilds from the graph. */
  reset(): Promise<void>;
  dump(): Promise<{ nodes: NodeRow[]; edges: EdgeRow[] }>;
  close(): Promise<void>;
}

/** In-memory store for tests and for verifying sync logic without the native module. */
export class MemoryStore implements MirrorStore {
  nodes = new Map<string, NodeRow>();
  edges = new Map<string, EdgeRow>();
  failNextApply: Error | null = null;
  applyDelayMs = 0;

  async load(): Promise<MirrorState> {
    const s = emptyState();
    for (const n of this.nodes.values()) s.nodes.set(n.id, n.sig);
    for (const e of this.edges.values()) s.edges.set(e.id, { sig: e.sig, type: e.type });
    return s;
  }
  async apply(d: MirrorDiff): Promise<void> {
    if (this.applyDelayMs) await new Promise((r) => setTimeout(r, this.applyDelayMs));
    if (this.failNextApply) {
      const err = this.failNextApply;
      this.failNextApply = null;
      throw err;
    }
    for (const e of d.deleteEdges) this.edges.delete(e.id);
    for (const id of d.deleteNodes) {
      this.nodes.delete(id);
      for (const [eid, e] of this.edges) if (e.source === id || e.target === id) this.edges.delete(eid);
    }
    for (const n of d.upsertNodes) this.nodes.set(n.id, n);
    for (const e of d.insertEdges) {
      if (!this.nodes.has(e.source) || !this.nodes.has(e.target)) throw new Error(`dangling edge ${e.id}`);
      this.edges.set(e.id, e);
    }
  }
  async reset(): Promise<void> {
    this.nodes.clear();
    this.edges.clear();
  }
  async dump() {
    const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
    return { nodes: [...this.nodes.values()].sort(byId), edges: [...this.edges.values()].sort(byId) };
  }
  async close(): Promise<void> {}
}

type Lbug = typeof import('@ladybugdb/core');

/** Load the native module; the reason is reported in status when it fails. */
export async function loadLadybug(): Promise<{ lbug: Lbug } | { error: string }> {
  try {
    const m = (await import('@ladybugdb/core')) as Lbug & { default?: Lbug };
    return { lbug: m.default ?? m };
  } catch (e) {
    return { error: (e as Error).message.split('\n')[0]! };
  }
}

const q = (name: string) => `\`${name}\``;

/**
 * LadybugDB layout: one `Node` table (labels list, title, path, stub, JSON
 * props, sig) and one relationship table per edge type, created on first use.
 */
// @lat: [[ladybug-mirror#Storage layout]]
export class LadybugStore implements MirrorStore {
  private db: InstanceType<Lbug['Database']> | null = null;
  private conn: InstanceType<Lbug['Connection']> | null = null;
  private readonly relTables = new Set<string>();

  constructor(
    private readonly lbug: Lbug,
    private readonly data: DataDir,
    private readonly dir = 'ladybug/db',
  ) {}

  get path(): string {
    return this.data.path(this.dir);
  }

  /** Read-only connection for queries, opened on the same database. */
  connection(): InstanceType<Lbug['Connection']> {
    if (!this.conn) throw new Error('Mirror store is not open');
    return this.conn;
  }

  async open(): Promise<void> {
    await mkdir(this.data.path('ladybug'), { recursive: true });
    this.db = new this.lbug.Database(this.path);
    this.conn = new this.lbug.Connection(this.db);
    await this.run(
      `CREATE NODE TABLE IF NOT EXISTS Node(id STRING PRIMARY KEY, labels STRING[], title STRING, path STRING, stub BOOLEAN, props STRING, sig STRING)`,
    );
    const tables = await this.all('CALL show_tables() RETURN *');
    for (const t of tables) if (t.type === 'REL') this.relTables.add(String(t.name));
  }

  async load(): Promise<MirrorState> {
    const s = emptyState();
    for (const r of await this.all('MATCH (n:Node) RETURN n.id AS id, n.sig AS sig')) s.nodes.set(String(r.id), String(r.sig));
    for (const t of this.relTables) {
      for (const r of await this.all(`MATCH ()-[r:${q(t)}]->() RETURN r.id AS id, r.sig AS sig`)) s.edges.set(String(r.id), { sig: String(r.sig), type: typeOfTable(t) });
    }
    return s;
  }

  async apply(d: MirrorDiff): Promise<void> {
    for (const e of d.insertEdges) await this.ensureRelTable(relTable(e.type));
    await this.run('BEGIN TRANSACTION');
    try {
      for (const e of d.deleteEdges) await this.exec(`MATCH ()-[r:${q(relTable(e.type))} {id: $id}]->() DELETE r`, { id: e.id });
      for (const id of d.deleteNodes) await this.exec('MATCH (n:Node {id: $id}) DETACH DELETE n', { id });
      for (const n of d.upsertNodes) {
        const p = { id: n.id, labels: n.labels, title: n.title, path: n.path ?? '', stub: n.stub, props: n.props, sig: n.sig };
        if (d.existingNodes.has(n.id)) {
          await this.exec('MATCH (n:Node {id: $id}) SET n.labels = $labels, n.title = $title, n.path = $path, n.stub = $stub, n.props = $props, n.sig = $sig', p);
        } else {
          await this.exec('CREATE (:Node {id: $id, labels: $labels, title: $title, path: $path, stub: $stub, props: $props, sig: $sig})', p);
        }
      }
      for (const e of d.insertEdges) {
        await this.exec(
          `MATCH (a:Node {id: $source}), (b:Node {id: $target}) CREATE (a)-[:${q(relTable(e.type))} {id: $id, sign: $sign, heading: $heading, props: $props, sig: $sig}]->(b)`,
          { source: e.source, target: e.target, id: e.id, sign: e.sign, heading: e.heading ?? '', props: e.props, sig: e.sig },
        );
      }
      await this.run('COMMIT');
    } catch (err) {
      await this.run('ROLLBACK').catch(() => {});
      throw err;
    }
  }

  async reset(): Promise<void> {
    await this.close();
    await rm(this.path, { recursive: true, force: true });
    await rm(`${this.path}.wal`, { force: true });
    this.relTables.clear();
    await this.open();
  }

  async dump() {
    const nodes = (await this.all('MATCH (n:Node) RETURN n.id AS id, n.labels AS labels, n.title AS title, n.path AS path, n.stub AS stub, n.props AS props, n.sig AS sig ORDER BY id')).map(
      (r) => ({ id: String(r.id), labels: r.labels as string[], title: String(r.title), path: r.path ? String(r.path) : null, stub: Boolean(r.stub), props: String(r.props), sig: String(r.sig) }),
    );
    const edges: EdgeRow[] = [];
    for (const t of this.relTables) {
      for (const r of await this.all(`MATCH (a)-[r:${q(t)}]->(b) RETURN r.id AS id, a.id AS source, b.id AS target, r.sign AS sign, r.heading AS heading, r.props AS props, r.sig AS sig`)) {
        edges.push({ id: String(r.id), type: typeOfTable(t), source: String(r.source), target: String(r.target), sign: Number(r.sign) < 0 ? -1 : 1, heading: r.heading ? String(r.heading) : null, props: String(r.props), sig: String(r.sig) });
      }
    }
    return { nodes, edges: edges.sort((a, b) => a.id.localeCompare(b.id)) };
  }

  async close(): Promise<void> {
    await this.conn?.close();
    await this.db?.close();
    this.conn = null;
    this.db = null;
  }

  private async ensureRelTable(name: string): Promise<void> {
    if (this.relTables.has(name)) return;
    await this.run(`CREATE REL TABLE IF NOT EXISTS ${q(name)}(FROM Node TO Node, id STRING, sign INT8, heading STRING, props STRING, sig STRING)`);
    this.relTables.add(name);
  }

  private async run(statement: string): Promise<void> {
    const r = await this.connection().query(statement);
    for (const x of Array.isArray(r) ? r : [r]) x.close();
  }

  private async exec(statement: string, params: Record<string, unknown>): Promise<void> {
    const conn = this.connection();
    const prepared = await conn.prepare(statement);
    const r = await conn.execute(prepared, params as never);
    for (const x of Array.isArray(r) ? r : [r]) x.close();
  }

  private async all(statement: string): Promise<Record<string, unknown>[]> {
    const r = await this.connection().query(statement);
    const one = Array.isArray(r) ? r[r.length - 1]! : r;
    const rows = await one.getAll();
    one.close();
    return rows as Record<string, unknown>[];
  }
}
