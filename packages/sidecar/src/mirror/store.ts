import { mkdir, rm } from 'node:fs/promises';
import type { DataDir } from '../data-dir.js';
import { COLUMN_SQL, EMPTY_REL_TABLE, emptyState, relTable, typeOfTable, type ColType, type EdgeRow, type MirrorDiff, type MirrorState, type NodeRow, type TypedValue } from './rows.js';

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

const SQL_TO_COL: Record<string, ColType> = { DOUBLE: 'n', STRING: 's', BOOLEAN: 'b', 'STRING[]': 'ls', 'DOUBLE[]': 'ln' };
const NODE_BASE_COLS = new Set(['id', 'labels', 'title', 'path', 'stub', 'props', 'sig']);
const REL_BASE_COLS = new Set(['id', 'sign', 'heading', 'src', 'dst', 'props', 'sig']);

type Conn = InstanceType<Lbug['Connection']>;

async function rowsOf(conn: Conn, statement: string): Promise<Record<string, unknown>[]> {
  const r = await conn.query(statement);
  const one = Array.isArray(r) ? r[r.length - 1]! : r;
  const rows = await one.getAll();
  one.close();
  return rows as Record<string, unknown>[];
}

/**
 * LadybugDB layout: one `Node` table and one relationship table per edge
 * type, with base columns plus one typed column per property name and kind
 * (`p_<name>_<kind>`), added on first use. An always-empty
 * `obsigraph_none` relationship table keeps impossible patterns valid.
 */
// @lat: [[ladybug-mirror#Storage layout]]
export class LadybugStore implements MirrorStore {
  private db: InstanceType<Lbug['Database']> | null = null;
  private conn: Conn | null = null;
  private readonly relTables = new Set<string>();
  /** Property columns per table: column -> kind. */
  private readonly columns = new Map<string, Map<string, ColType>>();

  constructor(
    readonly lbug: Lbug,
    private readonly data: DataDir,
    private readonly dir = 'ladybug/db',
  ) {}

  get path(): string {
    return this.data.path(this.dir);
  }

  connection(): Conn {
    if (!this.conn) throw new Error('Mirror store is not open');
    return this.conn;
  }

  /** Edge-type tables currently present (excluding the placeholder). */
  tables(): string[] {
    return [...this.relTables].filter((t) => t !== EMPTY_REL_TABLE);
  }

  /** A read-only snapshot of the database as of now, for queries. */
  openReadOnly(): { db: InstanceType<Lbug['Database']>; conn: Conn } {
    const db = new this.lbug.Database(this.path, 0, true, true);
    return { db, conn: new this.lbug.Connection(db) };
  }

  async open(): Promise<void> {
    await mkdir(this.data.path('ladybug'), { recursive: true });
    this.db = new this.lbug.Database(this.path);
    this.conn = new this.lbug.Connection(this.db);
    await this.run('CREATE NODE TABLE IF NOT EXISTS Node(id STRING PRIMARY KEY, labels STRING[], title STRING, path STRING, stub BOOLEAN, props STRING, sig STRING)');
    for (const t of await this.all('CALL show_tables() RETURN *')) if (t.type === 'REL') this.relTables.add(String(t.name));
    await this.ensureRelTable(EMPTY_REL_TABLE);
    for (const table of ['Node', ...this.relTables]) {
      const cols = new Map<string, ColType>();
      for (const c of await this.all(`CALL table_info('${table}') RETURN *`)) {
        const name = String(c.name);
        const kind = String(name).endsWith('_j') ? 'j' : SQL_TO_COL[String(c.type)];
        if (name.startsWith('p_') && kind) cols.set(name, kind);
      }
      this.columns.set(table, cols);
    }
  }

  async load(): Promise<MirrorState> {
    const s = emptyState();
    for (const r of await this.all('MATCH (n:Node) RETURN n.id AS id, n.sig AS sig')) s.nodes.set(String(r.id), String(r.sig));
    for (const t of this.tables()) {
      for (const r of await this.all(`MATCH ()-[r:${q(t)}]->() RETURN r.id AS id, r.sig AS sig`)) s.edges.set(String(r.id), { sig: String(r.sig), type: typeOfTable(t) });
    }
    return s;
  }

  async apply(d: MirrorDiff): Promise<void> {
    // Schema changes cannot run inside the data transaction.
    for (const n of d.upsertNodes) await this.ensureColumns('Node', n.cols);
    for (const e of d.insertEdges) {
      await this.ensureRelTable(relTable(e.type));
      await this.ensureColumns(relTable(e.type), e.cols);
    }
    await this.run('BEGIN TRANSACTION');
    try {
      for (const e of d.deleteEdges) await this.exec(`MATCH ()-[r:${q(relTable(e.type))} {id: $id}]->() DELETE r`, { id: e.id });
      for (const id of d.deleteNodes) await this.exec('MATCH (n:Node {id: $id}) DETACH DELETE n', { id });
      const nodeCols = [...this.columns.get('Node')!.keys()];
      for (const n of d.upsertNodes) {
        const p: Record<string, unknown> = { id: n.id, labels: n.labels, title: n.title, path: n.path ?? '', stub: n.stub, props: n.props, sig: n.sig };
        if (d.existingNodes.has(n.id)) {
          // Every property column is set, so properties removed from a note become NULL.
          const sets = ['labels', 'title', 'path', 'stub', 'props', 'sig'].map((k) => `n.${k} = $${k}`);
          for (const c of nodeCols) {
            sets.push(`n.${q(c)} = $${c}`);
            p[c] = n.cols[c]?.v ?? null;
          }
          await this.exec(`MATCH (n:Node {id: $id}) SET ${sets.join(', ')}`, p);
        } else {
          const keys = ['id', 'labels', 'title', 'path', 'stub', 'props', 'sig', ...Object.keys(n.cols)];
          for (const [c, tv] of Object.entries(n.cols)) p[c] = tv.v;
          await this.exec(`CREATE (:Node {${keys.map((k) => `${q(k)}: $${k}`).join(', ')}})`, p);
        }
      }
      for (const e of d.insertEdges) {
        const p: Record<string, unknown> = { source: e.source, target: e.target, id: e.id, sign: e.sign, heading: e.heading ?? '', src: e.source, dst: e.target, props: e.props, sig: e.sig };
        const keys = ['id', 'sign', 'heading', 'src', 'dst', 'props', 'sig', ...Object.keys(e.cols)];
        for (const [c, tv] of Object.entries(e.cols)) p[c] = tv.v;
        await this.exec(
          `MATCH (a:Node {id: $source}), (b:Node {id: $target}) CREATE (a)-[:${q(relTable(e.type))} {${keys.map((k) => `${q(k)}: $${k}`).join(', ')}}]->(b)`,
          p,
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
    this.columns.clear();
    await this.open();
  }

  async dump() {
    const typed = (row: Record<string, unknown>, table: string): Record<string, TypedValue> => {
      const out: Record<string, TypedValue> = {};
      for (const [c, t] of this.columns.get(table) ?? []) if (row[c] !== null && row[c] !== undefined) out[c] = { t, v: row[c] };
      return out;
    };
    const nodes: NodeRow[] = [];
    for (const r of await this.all('MATCH (n:Node) RETURN n ORDER BY n.id')) {
      const n = r.n as Record<string, unknown>;
      nodes.push({ id: String(n.id), labels: n.labels as string[], title: String(n.title), path: n.path ? String(n.path) : null, stub: Boolean(n.stub), props: String(n.props), cols: typed(n, 'Node'), sig: String(n.sig) });
    }
    const edges: EdgeRow[] = [];
    for (const t of this.tables()) {
      for (const r of await this.all(`MATCH ()-[r:${q(t)}]->() RETURN r`)) {
        const e = r.r as Record<string, unknown>;
        edges.push({ id: String(e.id), type: typeOfTable(t), source: String(e.src), target: String(e.dst), sign: Number(e.sign) < 0 ? -1 : 1, heading: e.heading ? String(e.heading) : null, props: String(e.props), cols: typed(e, t), sig: String(e.sig) });
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
    if (this.relTables.has(name) && this.columns.has(name)) return;
    await this.run(`CREATE REL TABLE IF NOT EXISTS ${q(name)}(FROM Node TO Node, id STRING, sign INT8, heading STRING, src STRING, dst STRING, props STRING, sig STRING)`);
    this.relTables.add(name);
    if (!this.columns.has(name)) this.columns.set(name, new Map());
  }

  private async ensureColumns(table: string, cols: Record<string, TypedValue>): Promise<void> {
    const known = this.columns.get(table)!;
    for (const [c, tv] of Object.entries(cols)) {
      if (known.has(c) || NODE_BASE_COLS.has(c) || REL_BASE_COLS.has(c)) continue;
      await this.run(`ALTER TABLE ${q(table)} ADD ${q(c)} ${COLUMN_SQL[tv.t]}`);
      known.set(c, tv.t);
    }
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

  private all(statement: string): Promise<Record<string, unknown>[]> {
    return rowsOf(this.connection(), statement);
  }
}

export { rowsOf };
