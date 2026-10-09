import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../src/cli.mjs';
import '../src/commands/index.mjs';

function folder(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-validate-'));
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

interface Json {
  ok: boolean;
  notes: number;
  counts: { error: number; warning: number };
  findings: { code: string; severity: string; path: string; line: number | null; message: string }[];
}
const json = (out: string) => JSON.parse(out) as Json;

const PERSON = '---\nschema:\n  properties: {email: {required: true}}\n  edges: {knows: Person}\n---\n';
const people = () =>
  folder({
    'Types/Person.md': PERSON,
    'Alice.md': '---\ntype: Person\nemail: a@x.org\n---\n\nknows:: [[Bob]]\nowns:: [[Car]]\n',
    'Bob.md': '---\ntype: Person\n---\n',
    '.obsidian/Ignored.md': '---\ntype: Person\n---\n',
  });

const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));

describe('tg validate', () => {
  // @lat: [[tests/tg-validate#Findings reported]]
  // @tg: verifies:: [[openspec:tg-validate#Validate a vault#Findings reported]]
  it('lists schema findings per note without changing the vault', async () => {
    const v = people();
    const before = new Map(files(v).map((f) => [f, readFileSync(f, 'utf8')]));
    const r = await tg(v, 'validate');
    expect(r.code).toBe(0);
    expect(r.out).toBe(
      [
        "Alice.md:7: warning edge-not-allowed: Edge type 'owns' is not allowed for Person (allowed: knows)",
        "Bob.md: warning missing-property: Missing required property 'email' for type Person",
        '',
        '0 errors and 2 warnings in 3 notes.',
        '',
      ].join('\n'),
    );
    for (const [f, t] of before) expect(readFileSync(f, 'utf8')).toBe(t);
  });

  // @lat: [[tests/tg-validate#Clean vault]]
  // @tg: verifies:: [[openspec:tg-validate#Validate a vault#Clean vault]]
  it('prints a one-line summary for a clean vault', async () => {
    const v = folder({ 'Types/Person.md': PERSON, 'Alice.md': '---\ntype: Person\nemail: a@x.org\n---\n' });
    expect(await tg(v, 'validate')).toEqual({ code: 0, out: 'No findings in 2 notes.\n', err: '' });
  });

  // @lat: [[tests/tg-validate#Vault without schemas]]
  // @tg: verifies:: [[openspec:tg-validate#Validate a vault#Vault without schemas]]
  it('reports only syntax and embed findings when there are no schema notes', async () => {
    const v = folder({ 'Alice.md': '---\ntype: Person\n---\nknows:: [[Bob]] {since: }\n\n{{ edge:  }}\n', 'Bob.md': '# Bob\n' });
    const r = json((await tg(v, 'validate', '--json')).out);
    expect(r.findings.map((f) => [f.code, f.line])).toEqual([
      ['edge-syntax', 4],
      ['embed', 6],
    ]);
  });

  // @lat: [[tests/tg-validate#Finding codes]]
  // @tg: verifies:: [[openspec:tg-validate#Finding codes and severities#Code on every finding]]
  // @tg: verifies:: [[openspec:tg-validate#Finding codes and severities#Declaration error]]
  it('gives every finding a code, a severity, a path and a 1-based line', async () => {
    const r = json((await tg(people(), 'validate', '--json')).out);
    expect(r.findings[0]).toEqual({ code: 'edge-not-allowed', severity: 'warning', path: 'Alice.md', line: 7, message: expect.stringContaining('owns') });
    const bad = folder({ 'Types/Thing.md': '---\nschema:\n  edges: 5\n---\n' });
    const d = await tg(bad, 'validate', '--json');
    expect(d.code).toBe(1);
    expect(json(d.out).findings).toEqual([{ code: 'invalid-declaration', severity: 'error', path: 'Types/Thing.md', line: null, message: expect.any(String) }]);
  });

  // @lat: [[tests/tg-validate#Exit codes]]
  // @tg: verifies:: [[openspec:tg-validate#Exit codes and strictness#Warnings pass by default]]
  // @tg: verifies:: [[openspec:tg-validate#Exit codes and strictness#Strict fails on warnings]]
  // @tg: verifies:: [[openspec:tg-validate#Exit codes and strictness#Missing vault]]
  it('passes on warnings, fails on them with --strict and rejects a missing vault', async () => {
    const v = people();
    expect((await tg(v, 'validate')).code).toBe(0);
    expect((await tg(v, 'validate', '--strict')).code).toBe(1);
    const m = await tg(v, 'validate', '--vault', 'nope');
    expect(m.code).toBe(2);
    expect(m.err).toContain('is not a directory');
    expect((await tg(v, 'validate', '--format', 'xml')).code).toBe(2);
  });

  // @lat: [[tests/tg-validate#Selecting findings]]
  // @tg: verifies:: [[openspec:tg-validate#Selecting findings#Ignore a code]]
  // @tg: verifies:: [[openspec:tg-validate#Selecting findings#Schema-only]]
  it('filters by code and checks only schema notes with --schema-only', async () => {
    const v = people();
    const ignored = json((await tg(v, 'validate', '--json', '--ignore', 'edge-not-allowed')).out);
    expect(ignored.findings.map((f) => f.code)).toEqual(['missing-property']);
    expect(ignored.counts).toEqual({ error: 0, warning: 1 });
    expect(json((await tg(v, 'validate', '--json', '--only', 'edge-not-allowed,too-many-edges')).out).findings.map((f) => f.code)).toEqual(['edge-not-allowed']);
    expect((await tg(v, 'validate', '--strict', '--ignore', 'edge-not-allowed,missing-property')).code).toBe(0);

    const dup = folder({
      'Types/A.md': '---\nschemas:\n  Person: {}\n---\n',
      'Types/B.md': '---\nschemas:\n  Person: {}\n---\n',
      'Alice.md': 'knows:: [[Bob]] {since: }\n',
    });
    const s = json((await tg(dup, 'validate', '--json', '--schema-only')).out);
    expect(s.findings.map((f) => [f.code, f.path])).toEqual([['duplicate-declaration', 'Types/B.md']]);
  });

  // @lat: [[tests/tg-validate#Output formats]]
  // @tg: verifies:: [[openspec:tg-validate#Output formats#JSON output]]
  // @tg: verifies:: [[openspec:tg-validate#Output formats#SARIF output]]
  it('writes one JSON document or a SARIF 2.1.0 log', async () => {
    const v = people();
    const j = await tg(v, 'validate', '--json');
    expect(json(j.out)).toMatchObject({ ok: true, notes: 3, counts: { error: 0, warning: 2 } });
    expect(json((await tg(v, 'validate', '--format', 'json', '--strict')).out).ok).toBe(false);

    const root = folder({});
    const s = await tg(root, 'validate', '--format', 'sarif', '--vault', v);
    const log = JSON.parse(s.out) as { version: string; runs: { tool: { driver: { rules: { id: string }[] } }; results: Record<string, unknown>[] }[] };
    expect(log.version).toBe('2.1.0');
    expect(log.runs[0]!.tool.driver.rules.map((r) => r.id)).toEqual(['edge-not-allowed', 'missing-property']);
    const first = log.runs[0]!.results[0] as { ruleId: string; level: string; locations: { physicalLocation: { artifactLocation: { uri: string }; region: { startLine: number } } }[] };
    expect(first.ruleId).toBe('edge-not-allowed');
    expect(first.level).toBe('warning');
    expect(first.locations[0]!.physicalLocation.artifactLocation.uri).toMatch(/\/Alice\.md$/);
    expect(first.locations[0]!.physicalLocation.region.startLine).toBe(7);
  });
});
