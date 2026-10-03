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

  path(name: string): string {
    const full = resolve(this.root, name);
    const vault = resolve(this.vaultDir);
    if (!(full === this.root || full.startsWith(`${this.root}/`))) throw new Error(`Refusing to write outside the data directory: ${name}`);
    if (full === vault || full.startsWith(`${vault}/`)) throw new Error(`Refusing to write inside the vault: ${name}`);
    return full;
  }

  /** Atomic write via a temporary file and rename. */
  async writeJson(name: string, value: unknown): Promise<void> {
    const full = this.path(name);
    await mkdir(dirname(full), { recursive: true });
    const tmp = `${full}.tmp`;
    await writeFile(tmp, JSON.stringify(value));
    await rename(tmp, full);
  }

  async readJson<T>(name: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(this.path(name), 'utf8')) as T;
    } catch {
      return null;
    }
  }
}
