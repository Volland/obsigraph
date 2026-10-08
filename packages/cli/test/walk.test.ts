import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { walkProject } from '../src/walk.mjs';

// @tg: verifies:: [[openspec:symbol-provider#Source walker#Ignored folder]]
it('skips ignored, dependency and dot folders and honors nested gitignore', () => {
  const root = mkdtempSync(join(tmpdir(), 'tg-walk-'));
  const put = (p: string, t = 'x') => {
    mkdirSync(join(root, p, '..'), { recursive: true });
    writeFileSync(join(root, p), t);
  };
  put('.gitignore', 'dist/\n*.log\n');
  put('src/a.ts');
  put('src/a.log');
  put('src/.gitignore', 'secret.ts\n');
  put('src/secret.ts');
  put('src/keep/secret.ts');
  put('dist/out.js');
  put('node_modules/dep/index.js');
  put('.github/workflows/x.yml');
  put('lat.md/a.md');
  expect(walkProject(root)).toEqual(['lat.md/a.md', 'src/.gitignore', 'src/a.ts']);
});
