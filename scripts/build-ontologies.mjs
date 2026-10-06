// Package the ontology gallery for the website: site/ontologies/<id>.zip for each ontology
// (its Types/, its Examples/, its README and the shared core), all.zip with every ontology composed
// into one vault, and the schema notes as single downloadable files. Needs the `zip` command.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SRC = 'ontologies';
const OUT = 'site/ontologies';
const ids = readdirSync(SRC).filter((f) => statSync(join(SRC, f)).isDirectory()).sort();
const picks = ids.filter((id) => id !== 'core');

function zip(stage, name) {
  const out = join(process.cwd(), OUT, `${name}.zip`);
  rmSync(out, { force: true });
  const r = spawnSync('zip', ['-qr', out, '.'], { cwd: stage });
  if (r.status !== 0) throw new Error(`zip failed for ${name}: ${r.stderr ?? r.error}`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'ontologies-'));

for (const id of picks) {
  const stage = join(tmp, id);
  cpSync(join(SRC, id), stage, { recursive: true });
  cpSync(join(SRC, 'core/Types/Core.md'), join(stage, 'Types/Core.md'));
  zip(stage, id);
  mkdirSync(join(OUT, id), { recursive: true });
  for (const f of readdirSync(join(SRC, id, 'Types'))) cpSync(join(SRC, id, 'Types', f), join(OUT, id, f));
}

const all = join(tmp, 'all');
mkdirSync(join(all, 'Types'), { recursive: true });
cpSync(join(SRC, 'core/Types'), join(all, 'Types'), { recursive: true });
for (const id of picks) {
  cpSync(join(SRC, id, 'Types'), join(all, 'Types'), { recursive: true });
  if (existsSync(join(SRC, id, 'Examples'))) cpSync(join(SRC, id, 'Examples'), join(all, 'Examples', id), { recursive: true });
  cpSync(join(SRC, id, 'README.md'), join(all, 'Examples', id, 'README.md'));
}
cpSync(join(SRC, 'README.md'), join(all, 'README.md'));
zip(all, 'all');
mkdirSync(join(OUT, 'core'), { recursive: true });
cpSync(join(SRC, 'core/Types/Core.md'), join(OUT, 'core/Core.md'));
rmSync(tmp, { recursive: true, force: true });
console.log(`Packaged ${picks.length} ontologies and all.zip into ${OUT}`);
