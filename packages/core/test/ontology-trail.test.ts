import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { STEPS } from '../../../site/src/trail-steps';

const EXAMPLES = join(__dirname, '../../../ontologies/zettelkasten/Examples');

// @lat: [[tests/ontology-gallery#Zettelkasten trail steps exist]]
it('names only example notes that exist, each in one step, in a growing trail', () => {
  const titles = new Set(readdirSync(EXAMPLES).map((f) => f.replace(/\.md$/, '')));
  const named = STEPS.flatMap((s) => s.nodes);
  for (const t of named) expect(titles.has(t), `${t} is not an example note`).toBe(true);
  expect(new Set(named).size).toBe(named.length);
  expect(STEPS.length).toBeGreaterThanOrEqual(5);
  for (const s of STEPS) {
    expect(s.nodes.length, s.title).toBeGreaterThan(0);
    expect(s.text.length, s.title).toBeGreaterThan(40);
  }
});
