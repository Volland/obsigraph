import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/**
 * The only place the sidecar writes. Every write is checked to land inside
 * the data directory and never inside the vault.
 */
// @lat: [[sidecar#Security]]
export class DataDir {
  constructor(
    readonly root: string,
    private readonly vaultDir: string,
  ) {}

  // @tg: implements:: [[openspec:sidecar-service#Read-only vault access]]
  path(name: string): string {
    const full = resolve(this.root, name);
    const vault = resolve(this.vaultDir);
    if (!(full === this.root || full.startsWith(`${this.root}/`))) throw new Error(`Refusing to write outside the data directory: ${name}`);
    if (full === vault || full.startsWith(`${vault}/`)) throw new Error(`Refusing to write inside the vault: ${name}`);
    return full;
  }

  private readonly queues = new Map<string, Promise<void>>();
  private seq = 0;

  /**
   * Atomic write via a unique temporary file and rename. Writes to the same
   * file run in call order, so the last call's snapshot always wins.
   */
  writeJson(name: string, value: unknown): Promise<void> {
    const full = this.path(name);
    const json = JSON.stringify(value);
    const tmp = `${full}.${process.pid}.${++this.seq}.tmp`;
    const prev = this.queues.get(full) ?? Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(full), { recursive: true });
        await writeFile(tmp, json);
        await rename(tmp, full);
      });
    this.queues.set(full, next);
    void next.finally(() => {
      if (this.queues.get(full) === next) this.queues.delete(full);
    }).catch(() => {});
    return next;
  }

  async readJson<T>(name: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(this.path(name), 'utf8')) as T;
    } catch {
      return null;
    }
  }
}
