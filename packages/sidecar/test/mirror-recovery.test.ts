import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startSidecar, type Sidecar } from '../src/main.mjs';
import { LadybugStore, loadLadybug, MemoryStore } from '../src/mirror/store.mjs';

const available = 'lbug' in (await loadLadybug());
const dirs: string[] = [];
const running: Sidecar[] = [];
afterEach(async () => {
  for (const sc of running.splice(0)) await sc.stop();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tmp() {
  const root = mkdtempSync(join(tmpdir(), 'obsigraph-mirror-rec-'));
  dirs.push(root);
  mkdirSync(join(root, 'vault'));
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'vault', 'Alice.md'), 'knows:: [[Bob]]');
  const env = { OBSIGRAPH_VAULT: join(root, 'vault'), OBSIGRAPH_DATA: join(root, 'data'), OBSIGRAPH_TOKEN: 'x', OBSIGRAPH_PORT: '0', OBSIGRAPH_VECTORS: '0' };
  return { root, env };
}

const get = async (sc: Sidecar, path: string) => (await fetch(`http://127.0.0.1:${sc.port}${path}`, { headers: { authorization: 'Bearer x' } })).json() as Promise<{ mirror: { state: string; message: string } }>;
const query = async (sc: Sidecar, q: string, backend = 'builtin') =>
  fetch(`http://127.0.0.1:${sc.port}/query`, { method: 'POST', headers: { authorization: 'Bearer x' }, body: JSON.stringify({ query: q, backend }) });

describe('mirror recovery at startup', () => {
  // @lat: [[tests/mirror-sync#Corrupt database rebuilt]]
  // @tg: verifies:: [[openspec:ladybug-mirror#Stale or incompatible mirror is rebuilt#Corrupt database]]
  it.skipIf(!available)('discards a database that cannot be opened, rebuilds it and keeps serving', async () => {
    const t = tmp();
    const first = await startSidecar(t.env, { log: () => {} });
    const dbPath = (first.mirror!.store as LadybugStore).path;
    await first.mirror!.idle();
    await first.stop();
    rmSync(dbPath, { recursive: true, force: true });
    rmSync(`${dbPath}.wal`, { force: true });
    writeFileSync(dbPath, Buffer.alloc(64 * 1024, 7));

    const logs: string[] = [];
    const sc = await startSidecar(t.env, { log: (m) => logs.push(m) });
    running.push(sc);
    expect(logs.some((l) => /discarding and rebuilding/.test(l))).toBe(true);
    expect(sc.mirror).not.toBeNull();
    await sc.mirror!.idle();
    expect(sc.mirror!.status()).toMatchObject({ state: 'idle', nodes: 2, edges: 1 });
    expect(sc.mirror!.status().rebuilds).toBeGreaterThanOrEqual(1);
    const l = await query(sc, 'MATCH (a)-->(b) RETURN b.title', 'ladybug');
    expect(l.status).toBe(200);
    expect(((await l.json()) as { rows: unknown }).rows).toEqual([['Bob']]);
  });

  // @lat: [[tests/mirror-sync#Unopenable mirror leaves sidecar serving]]
  it('keeps serving with the mirror unavailable when the store cannot be opened or rebuilt', async () => {
    class Broken extends MemoryStore {
      override async load(): Promise<never> {
        throw new Error('mirror storage is unreadable');
      }
    }
    for (const mirrorStore of [async () => new Broken(), async (): Promise<never> => { throw new Error('cannot create store'); }]) {
      const t = tmp();
      const sc = await startSidecar(t.env, { log: () => {}, mirrorStore });
      running.push(sc);
      expect(sc.mirror).toBeNull();
      const status = await get(sc, '/status');
      expect(status.mirror.state).toBe('unavailable');
      expect(status.mirror.message).toMatch(/could not be opened: (mirror storage is unreadable|cannot create store)/);
      const b = await query(sc, 'MATCH (a)-->(b) RETURN b.title');
      expect(((await b.json()) as { rows: unknown }).rows).toEqual([['Bob']]);
      const l = await query(sc, 'MATCH (n) RETURN n', 'ladybug');
      expect(l.status).toBe(503);
    }
  });
});
