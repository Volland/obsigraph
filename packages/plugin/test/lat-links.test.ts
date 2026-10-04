import { LatIndex } from '@obsigraph/core';
import { expect, it } from 'vitest';
import { inLatFolder, latDiagnostics, latLinkTarget } from '../src/lat-links';

const index = new LatIndex([
  { path: 'lat.md/lat.md', text: '# Lat\n\nIndex.\n\n- [[architecture]] — a\n' },
  { path: 'lat.md/architecture.md', text: '# Architecture\n\nOverview.\n\n## Monorepo layout\n\nPackages.\n\n### core\n\nThe core package, see [[nowhere#x]].\n' },
]);

// @lat: [[tests/tg-vault#Read in place#Nested heading link]]
it('resolves nested heading and short ids to the section line', () => {
  const full = latLinkTarget(index, 'architecture#Monorepo layout#core');
  expect(full).toEqual({ kind: 'open', path: 'lat.md/architecture.md', line: 8 });
  expect(latLinkTarget(index, 'lat.md/architecture#Architecture#Monorepo layout')).toMatchObject({ kind: 'open', line: 4 });
  expect(latLinkTarget(index, 'architecture')).toBeNull();
  expect(latLinkTarget(index, 'nowhere#x')).toBeNull();
  expect(inLatFolder('docs/lat.md/a.md')).toBe(true);
  expect(inLatFolder('notes/a.md')).toBe(false);
});

// @lat: [[tests/tg-vault#Read in place#Code link]]
it('reports source links instead of opening them, and surfaces broken links as diagnostics', () => {
  expect(latLinkTarget(index, 'src/config.ts#getConfigDir')).toEqual({ kind: 'code', file: 'src/config.ts', symbol: 'getConfigDir' });
  const d = latDiagnostics(index);
  expect(d.map((x) => x.message)).toEqual([expect.stringContaining('broken link [[nowhere#x]]')]);
  expect(d[0]).toMatchObject({ path: 'lat.md/architecture.md', line: 10 });
});
