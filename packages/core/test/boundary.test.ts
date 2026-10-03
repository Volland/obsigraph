import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

// @lat: [[tests/edge-parsing#Core has no host imports]]
it('core source has no Obsidian or DOM dependencies', () => {
  const offenders = files(SRC).filter((f) => {
    const src = readFileSync(f, 'utf8');
    return /from\s+['"]obsidian['"]/.test(src) || /\b(document|window|HTMLElement)\./.test(src);
  });
  expect(offenders).toEqual([]);
});
