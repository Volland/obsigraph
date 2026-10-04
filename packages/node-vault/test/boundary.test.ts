import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');

// @lat: [[tests/node-vault#No host imports]]
it('loader sources import no host module', () => {
  const offenders = readdirSync(SRC)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => /from\s+['"](obsidian|vscode)['"]/.test(readFileSync(join(SRC, f), 'utf8')));
  expect(offenders).toEqual([]);
});
