import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildStylesheet } from '../src/index';

const flat = (rules: ReturnType<typeof buildStylesheet>) => JSON.stringify(rules);

// @lat: [[tests/graph-ui#Theme supplied by host]]
// @tg: verifies:: [[openspec:graph-ui#Host-independent rendering#Theme supplied by host]]
it('uses exactly the colors the host passes', () => {
  const sheet = flat(buildStylesheet({ text: '#123456', muted: '#abcdef', background: '#fedcba' }));
  expect(sheet).toContain('#123456');
  expect(sheet).toContain('#abcdef');
  expect(sheet).toContain('#fedcba');
  expect(flat(buildStylesheet({ text: '#111111', muted: '#222222', background: '#333333' }))).not.toContain('#123456');
});

// @lat: [[tests/graph-ui#Negative edge looks the same]]
// @tg: verifies:: [[openspec:graph-ui#Host-independent rendering#Negative edge]]
it('gives a negative edge a tee arrow regardless of theme', () => {
  for (const theme of [{ text: '#000', muted: '#999', background: '#fff' }, { text: '#fff', muted: '#666', background: '#1e1e1e' }]) {
    const rule = buildStylesheet(theme).find((r) => r.selector.includes('negative'));
    expect(rule, JSON.stringify(theme)).toBeDefined();
    expect(JSON.stringify(rule!.style)).toContain('tee');
  }
});

// @lat: [[tests/graph-ui#Graph UI has no host imports]]
// @tg: verifies:: [[openspec:graph-ui#No host imports#Import check]]
it('imports no host module', () => {
  const src = join(import.meta.dirname, '..', 'src');
  const offenders = readdirSync(src)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => /from\s+['"](obsidian|vscode)['"]/.test(readFileSync(join(src, f), 'utf8')));
  expect(offenders).toEqual([]);
});
