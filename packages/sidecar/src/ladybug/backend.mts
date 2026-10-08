import { CypherError, parseQuery, type JsonQueryResult, type JsonValue, type Query } from '@obsigraph/core';
import type { LadybugMirror } from '../mirror/mirror.mjs';
import { propertyTypes } from '../mirror/rows.mjs';
import type { LadybugStore } from '../mirror/store.mjs';
import type { VaultSync } from '../sync.mjs';
import { fromLadybug, inferKind } from './convert.mjs';
import { assertReadOnly } from './guard.mjs';
import { transpile } from './transpile.mjs';

/** Raised when the mirror cannot answer yet; maps to HTTP 503. */
export class BackendUnavailable extends Error {
  constructor(
    readonly kind: 'unavailable' | 'not_ready',
    message: string,
  ) {
    super(message);
  }
}

export interface LadybugBackendOptions {
  maxPathDepth: number;
  timeoutMs: number;
  /** How long a read waits for pending syncs before answering with a staleness notice. */
  freshnessWaitMs?: number;
}

/**
 * Runs queries on the LadybugDB mirror through a read-only snapshot. Parsed
 * queries are translated onto the mirror layout; text outside the built-in
 * parser's subset passes through unchanged after the read-only guard.
 */
// @lat: [[ladybug-mirror#Storage layout]]
export class LadybugBackend {
  private snapshot: ReturnType<LadybugStore['openReadOnly']> | null = null;
  private snapshotVersion = -1;

  constructor(
    private readonly store: LadybugStore,
    private readonly mirror: LadybugMirror,
    private readonly sync: VaultSync,
    private readonly opts: LadybugBackendOptions,
  ) {}

  // @tg: implements:: [[openspec:ladybug-backend#Clear error when unavailable]]
  // @tg: implements:: [[openspec:ladybug-backend#Freshness before reads]]
  // @tg: implements:: [[openspec:ladybug-backend#Full Cypher for reads]]
  // @tg: implements:: [[openspec:ladybug-backend#Same interface and result contract]]
  async run(query: string, params: Record<string, unknown> = {}): Promise<JsonQueryResult> {
    assertReadOnly(query);
    const notices: string[] = [];

    // Freshness: let pending file events and the mirror sync land first.
    const settled = await Promise.race([
      (async () => {
        await this.sync.idle();
        await this.mirror.idle();
        return true;
      })(),
      new Promise<false>((r) => setTimeout(() => r(false), this.opts.freshnessWaitMs ?? 3000)),
    ]);
    const st = this.mirror.status();
    // A failed sync is terminal until a later sync succeeds: never serve the
    // last good snapshot silently, and never report a failed first build as
    // "not ready", which clients retry forever.
    if (st.state === 'failed') {
      throw new BackendUnavailable('unavailable', `The Ladybug mirror failed to sync: ${st.message ?? 'unknown error'}. It is retried on the next note change; restart the sidecar to rebuild it.`);
    }
    if (!this.mirror.ready) throw new BackendUnavailable('not_ready', 'The Ladybug mirror is still building; try again shortly.');
    if (!settled) notices.push('The Ladybug mirror is syncing; results may be stale.');

    let parsed: Query | null = null;
    let parseError: CypherError | null = null;
    try {
      parsed = parseQuery(query);
    } catch (e) {
      if (!(e instanceof CypherError) || (e.kind !== 'unsupported' && e.kind !== 'syntax')) throw e;
      if (e.kind === 'syntax') parseError = e;
      notices.push('This query uses syntax outside the built-in subset and runs on Ladybug untranslated: use the mirror layout (Node table, label lists, p_<name>_<kind> columns).');
    }

    const conn = this.connection();
    conn.setQueryTimeout(this.opts.timeoutMs);

    if (parsed) {
      const t = transpile(parsed, {
        types: propertyTypes(this.sync.graph),
        tables: new Set(this.store.tables()),
        maxDepth: this.opts.maxPathDepth,
      });
      notices.push(...t.notices);
      const rows = await this.execute(conn, t.text, params);
      const out: JsonQueryResult = { columns: t.columns, rows: rows.map((r) => t.keys.map((k) => fromLadybug(r[k]))) };
      if (notices.length) out.notices = notices;
      return out;
    }

    let res: { rows: Record<string, unknown>[]; names: string[] };
    try {
      res = await this.raw(conn, query, params);
    } catch (e) {
      // Malformed for both parsers: the built-in error carries the better position.
      if (parseError && e instanceof CypherError && e.kind === 'syntax') throw parseError;
      throw e;
    }
    const names = res.names;
    const rows = res.rows.map((r) => names.map((n) => fromLadybug(r[n])));
    const out: JsonQueryResult = {
      columns: names.map((name, i) => ({ name, kind: inferKind(rows.map((r) => r[i] as JsonValue)) })),
      rows,
    };
    if (notices.length) out.notices = notices;
    return out;
  }

  close(): void {
    this.snapshot?.conn.closeSync();
    this.snapshot?.db.closeSync();
    this.snapshot = null;
  }

  /** Read-only snapshot, reopened whenever the mirror has synced since. */
  private connection() {
    if (!this.snapshot || this.snapshotVersion !== this.mirror.version) {
      this.close();
      this.snapshot = this.store.openReadOnly();
      this.snapshotVersion = this.mirror.version;
    }
    return this.snapshot.conn;
  }

  private async execute(conn: ReturnType<LadybugStore['openReadOnly']>['conn'], text: string, params: Record<string, unknown>) {
    return (await this.raw(conn, text, params)).rows;
  }

  // @tg: implements:: [[openspec:ladybug-backend#Errors reported with position]]
  private async raw(conn: ReturnType<LadybugStore['openReadOnly']>['conn'], text: string, params: Record<string, unknown>) {
    try {
      const prepared = await conn.prepare(text);
      const r = await conn.execute(prepared, params as never);
      const one = Array.isArray(r) ? r[r.length - 1]! : r;
      const rows = (await one.getAll()) as Record<string, unknown>[];
      const names = await one.getColumnNames();
      one.close();
      return { rows, names };
    } catch (e) {
      const msg = (e as Error).message.split('\n')[0]!;
      if (/interrupt|timeout/i.test(msg)) throw new CypherError('timeout', 'Query timed out', 0, 0);
      const pos = /line: (\d+), offset: (\d+)/.exec(msg);
      throw new CypherError(/parser exception/i.test(msg) ? 'syntax' : 'runtime', `Ladybug: ${msg}`, pos ? Number(pos[1]) : 0, pos ? Number(pos[2]) + 1 : 0);
    }
  }
}
