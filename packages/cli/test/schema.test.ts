import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { run } from '../src/cli.mjs';
import '../src/commands/index.mjs';

function folder(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-schema-'));
  for (const [p, t] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    writeFileSync(join(dir, p), t);
  }
  return dir;
}

async function tg(cwd: string, ...args: string[]) {
  let out = '';
  let err = '';
  const code = await run(args, { cwd, out: (t) => (out += t), err: (t) => (err += t), env: {} });
  return { code, out, err };
}

// @lat: [[tests/shacl-interop#Schema commands]]
// @tg: verifies:: [[openspec:shacl-interop#Export schemas as SHACL#Empty schema folder]]
// @tg: verifies:: [[openspec:shacl-interop#Export schemas as SHACL#Export from the CLI]]
it('exports schema notes as SHACL and imports them into another vault with a report', async () => {
  const v = folder({
    'Types/Person.md': '---\nschema:\n  properties: {email: {required: true}}\n  edges: {worksAt: Company}\n---\n\n## Notes\n',
    'Types/Company.md': '---\nschema: {}\n---\n',
    'Alice.md': '---\ntype: Person\n---\n',
  });
  const r = await tg(v, 'schema', 'export', 'out/shapes.ttl');
  expect(r.code).toBe(0);
  expect(r.out).toBe('Exported 2 types and 0 edge types from Types/ to out/shapes.ttl as SHACL.\n');
  const ttl = readFileSync(join(v, 'out/shapes.ttl'), 'utf8');
  expect(ttl).toContain(':PersonShape\n    a sh:NodeShape ;');
  expect((await tg(v, 'schema', 'export', 'again.ttl')).code).toBe(0);
  expect(readFileSync(join(v, 'again.ttl'), 'utf8')).toBe(ttl);

  const empty = folder({ 'Note.md': '# Hi\n' });
  const e = await tg(empty, 'schema', 'export', 'shapes.ttl');
  expect(e.code).toBe(0);
  expect(e.out).toBe('No types found in Types/; wrote prefixes only to shapes.ttl.\n');

  const target = folder({});
  const i = await tg(target, 'schema', 'import', join(v, 'out/shapes.ttl'), '--layout', 'single', '--into', 'Org');
  expect(i.code).toBe(0);
  expect(i.out).toContain('created Types/Org.md (Company, Person)');
  expect(i.out).toContain('Drop report: everything was imported.');
  expect(readFileSync(join(target, 'Types/Org.md'), 'utf8')).toBe('---\nschemas:\n  Company: {}\n  Person:\n    properties:\n      email: {required: true}\n    edges: {worksAt: Company}\n---\n');

  writeFileSync(join(target, 'bad.ttl'), '@prefix sh: <http://www.w3.org/ns/shacl#> .\n<urn:x:S> sh:targetClass <urn:x:T> ; sh:closed true .\n');
  const d = await tg(target, 'schema', 'import', 'bad.ttl', '--json');
  expect(d.code).toBe(0);
  expect(JSON.parse(d.out).dropped).toEqual([{ shape: 'T', construct: 'sh:closed' }]);
  expect((await tg(target, 'schema', 'import', 'missing.ttl')).code).toBe(2);
  expect((await tg(target, 'schema', 'convert', 'x')).code).toBe(2);
});
