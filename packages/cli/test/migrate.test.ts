import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { run, type Io } from '../src/cli.mjs';
import '../src/commands/index.mjs';

// Split so tg check on this repository does not read fixtures as annotations.
const LAT = '@' + 'lat:';
const TG = '@' + 'tg:';

const git = (dir: string, ...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });

/** A committed lat.md project. */
function latProject(files: Record<string, string>, commit = true): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-migrate-'));
  // The index lists every top-level file and folder, as tg check requires.
  const entries = new Set(Object.keys(files).filter((p) => p.startsWith('lat.md/')).map((p) => p.slice(7).split('/')[0]!.replace(/\.md$/, '')));
  const all: Record<string, string> = { 'lat.md/lat.md': `# Lat\n\nIndex.\n\n${[...entries].map((e) => `- [[${e}]] — ${e}`).join('\n')}\n`, ...files };
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  if (commit) {
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 't@example.com');
    git(dir, 'config', 'user.name', 't');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'init');
  }
  return dir;
}

async function tg(cwd: string, args: string[]) {
  let out = '';
  const io: Io = { cwd, out: (t) => (out += t), err: (t) => (out += t), env: {}, stdin: () => '' };
  const code = await run(args, io);
  return { code, out };
}

const read = (dir: string, rel: string) => readFileSync(join(dir, rel), 'utf8');
const plan = async (dir: string, ...extra: string[]) =>
  JSON.parse((await tg(dir, ['migrate', '--dry-run', '--json', '--no-setup', ...extra])).out) as {
    typed: { file: string; type: string }[];
    edges: { type: string; target: string; props: Record<string, string> }[];
    upgraded: { file: string; type: string }[];
    unresolved: { file: string; line: number; section: string; target: string; reason: string; candidates: string[]; text: string }[];
  };

const BASE = {
  'lat.md/constraints.md': '# Constraints\n\nRules we did not choose.\n\n## Session limit\n\nEvery session MUST end after 15 minutes, see [[requirements#Token expiry]].\n',
  'lat.md/requirements.md': '# Requirements\n\nWhat the system shall do.\n\n## Token expiry\n\nThe system SHALL expire access tokens after 15 minutes.\n',
  'lat.md/glossary.md': '# Glossary\n\nTerms.\n\n## Session\n\nA signed-in period of use.\n',
};
const withDecisions = (body: string) => ({ ...BASE, 'lat.md/decisions.md': `# Decisions\n\nChoices we made.\n\n## Short tokens\n\n${body}\n\n## Long sessions\n\nSessions lasted a day.\n` });

// @lat: [[tests/tg-migrate#Migrate command#Dry run]]
// @tg: verifies:: [[openspec:tg-migrate#Migrate command#Dry run]]
it('prints a diff and changes nothing with --dry-run', async () => {
  const dir = latProject(withDecisions('Tokens are short because of [[constraints#Session limit]].'));
  const before = read(dir, 'lat.md/decisions.md');
  const r = await tg(dir, ['migrate', '--dry-run']);
  expect(r.out).toContain('+++ b/lat.md/decisions.md');
  expect(r.out).toContain('Dry run:');
  expect(read(dir, 'lat.md/decisions.md')).toBe(before);
  expect(existsSync(join(dir, 'Types'))).toBe(false);
});

// @lat: [[tests/tg-migrate#Migrate command#Idempotent]]
// @tg: verifies:: [[openspec:tg-migrate#Migrate command#Idempotent]]
it('changes nothing on a second run, and the migrated project checks clean', async () => {
  const dir = latProject(withDecisions('Tokens are short because of [[constraints#Session limit]].'));
  expect((await tg(dir, ['migrate'])).code).toBe(0);
  expect((await tg(dir, ['check'])).out).toContain('All checks passed');
  expect((await tg(dir, ['ontology', 'check'])).code).toBe(0);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'migrated');
  expect((await tg(dir, ['migrate'])).out).toContain('Nothing to migrate');
});

// @lat: [[tests/tg-migrate#File typing#Decisions typed by name]]
// @tg: verifies:: [[openspec:tg-migrate#File typing#Decisions typed by name]]
it('types files by their path and requirement content, never index files', async () => {
  const dir = latProject({
    ...withDecisions('Short.'),
    'lat.md/tests/tests.md': '# Tests\n\nSpecs.\n\n- [[auth]] — auth\n',
    'lat.md/tests/auth.md': '# Auth\n\nAuth specs.\n\n## Expired\n\nRejected.\n',
    'lat.md/billing.md': '# Billing\n\nMoney.\n\n## Refunds\n\nThe system SHALL refund within 14 days.\n\n## Invoices\n\nThe system MUST send invoices.\n',
  });
  const p = await plan(dir);
  expect(Object.fromEntries(p.typed.map((t) => [t.file, t.type]))).toEqual({
    'lat.md/billing.md': 'Requirement',
    'lat.md/constraints.md': 'Constraint',
    'lat.md/decisions.md': 'Decision',
    'lat.md/glossary.md': 'Concept',
    'lat.md/requirements.md': 'Requirement',
    'lat.md/tests/auth.md': 'Scenario',
  });
  await tg(dir, ['migrate', '--no-setup']);
  expect(read(dir, 'lat.md/decisions.md').startsWith('---\ntype: Decision\n---\n# Decisions\n')).toBe(true);
  expect(read(dir, 'lat.md/lat.md').startsWith('# Lat')).toBe(true);
});

// @lat: [[tests/tg-migrate#File typing#Existing type kept]]
// @tg: verifies:: [[openspec:tg-migrate#File typing#Existing type kept]]
it('keeps an existing type', async () => {
  const dir = latProject({ ...BASE, 'lat.md/decisions.md': '---\ntype: Concept\n---\n# Decisions\n\nNot really decisions.\n' });
  expect((await plan(dir)).typed.map((t) => t.file)).not.toContain('lat.md/decisions.md');
});

// @lat: [[tests/tg-migrate#Link typing#Cued relation]]
// @tg: verifies:: [[openspec:tg-migrate#Link typing#Cued relation]]
it('writes a cued relation as a typed edge line and keeps the prose link', async () => {
  const dir = latProject(withDecisions('Tokens are short because of [[constraints#Session limit]].'));
  await tg(dir, ['migrate', '--no-setup', '--no-since']);
  const text = read(dir, 'lat.md/decisions.md');
  expect(text).toContain('Tokens are short because of [[constraints#Session limit]].\n\n- motivated_by:: [[constraints#Session limit]]\n\n## Long sessions');
});

// @lat: [[tests/tg-migrate#Link typing#Sentence scope]]
// @tg: verifies:: [[openspec:tg-migrate#Link typing#Sentence scope]]
it('reads cue words from the sentence of each link', async () => {
  const dir = latProject(withDecisions('Tokens are short because of [[constraints#Session limit]]. This replaces [[decisions#Long sessions]].'));
  const p = await plan(dir, '--no-since');
  expect(p.edges.filter((e) => e.type !== 'constrains').map((e) => [e.type, e.target])).toEqual([
    ['motivated_by', 'constraints#Session limit'],
    ['supersedes', 'decisions#Long sessions'],
  ]);
});

// @lat: [[tests/tg-migrate#Link typing#Ambiguous link left plain]]
// @tg: verifies:: [[openspec:tg-migrate#Link typing#Ambiguous link left plain]]
it('reports an ambiguous link with its candidates and sentence', async () => {
  const dir = latProject(withDecisions('It relates to [[decisions#Long sessions]].'));
  const p = await plan(dir);
  expect(p.edges.filter((e) => e.type !== 'constrains')).toEqual([]);
  expect(p.unresolved).toEqual([
    { file: 'lat.md/decisions.md', line: 7, section: 'lat.md/decisions#Decisions#Short tokens', target: 'decisions#Long sessions', reason: 'ambiguous', candidates: ['supersedes', 'motivated_by'], text: 'It relates to [[decisions#Long sessions]].' },
  ]);
});

// @lat: [[tests/tg-migrate#Link typing#No cue without infer]]
// @tg: verifies:: [[openspec:tg-migrate#Link typing#No cue without infer]]
it('needs a cue for a single candidate unless --infer is given', async () => {
  const dir = latProject(withDecisions('See [[glossary#Session]].'));
  const p = await plan(dir);
  expect(p.unresolved.map((u) => [u.reason, u.candidates])).toEqual([['no cue', ['motivated_by']]]);
  const inferred = await plan(dir, '--infer');
  expect(inferred.edges.map((e) => e.type)).toEqual(['constrains', 'motivated_by']);
});

// @lat: [[tests/tg-migrate#Edge metadata#Strength from the sentence]]
// @tg: verifies:: [[openspec:tg-migrate#Edge metadata#Strength from the sentence]]
it('adds strength from the sentence and since from git', async () => {
  const dir = latProject(withDecisions('Tokens are short because of [[constraints#Session limit]].'));
  const p = await plan(dir);
  // The bundled constrains edge declares strength but not since; motivated_by declares since.
  expect(p.edges.find((e) => e.type === 'constrains')!.props).toEqual({ strength: 'must' });
  expect(p.edges.find((e) => e.type === 'motivated_by')!.props.since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await tg(dir, ['migrate', '--no-setup', '--no-since']);
  expect(read(dir, 'lat.md/constraints.md')).toContain('- constrains:: [[requirements#Token expiry]] {strength: must}');
});

// @lat: [[tests/tg-migrate#Edge metadata#Undeclared property not added]]
// @tg: verifies:: [[openspec:tg-migrate#Edge metadata#Undeclared property not added]]
it('adds only properties the edge type declares', async () => {
  const dir = latProject({
    ...withDecisions('Tokens are short because of [[constraints#Session limit]].'),
    'Types/code-types.md': '---\nschemas:\n  Decision: {}\n  Constraint: {}\nedgeTypes:\n  motivated_by:\n    from: Decision\n    to: Constraint\n---\n# Types\n\nMinimal.\n',
  });
  const p = await plan(dir);
  expect(p.edges).toEqual([expect.objectContaining({ type: 'motivated_by', props: {} })]);
});

// @lat: [[tests/tg-migrate#Code reference upgrade#Implementation upgraded]]
// @tg: verifies:: [[openspec:tg-migrate#Code reference upgrade#Implementation upgraded]]
it('upgrades @lat comments to implements and verifies by the target type', async () => {
  const dir = latProject({
    ...BASE,
    'lat.md/tests/tests.md': '# Tests\n\nSpecs.\n\n- [[auth]] — auth\n',
    'lat.md/tests/auth.md': '# Auth\n\nAuth specs.\n\n## Expired\n\nRejected.\n',
    'src/token.ts': `// ${LAT} [[requirements#Token expiry]]\nexport function refresh() {}\n\n  # ${LAT} [[glossary#Session]]\nexport function session() {}\n`,
    'test/e2e/token.test.ts': `// ${LAT} [[tests/auth#Expired]]\nit('rejects', () => {});\n`,
  });
  await tg(dir, ['migrate', '--no-setup']);
  const src = read(dir, 'src/token.ts');
  expect(src).toMatch(new RegExp(`^// ${TG} implements:: \\[\\[requirements#Token expiry\\]\\] \\{since: "\\d{4}-\\d{2}-\\d{2}"\\}\n`));
  expect(src).toContain(`  # ${LAT} [[glossary#Session]]`);
  expect(read(dir, 'test/e2e/token.test.ts')).toMatch(new RegExp(`^// ${TG} verifies:: \\[\\[tests/auth#Expired\\]\\] \\{since: "[\\d-]+", level: e2e\\}`));
  expect((await tg(dir, ['check'])).out).toContain('All checks passed');
});

// @lat: [[tests/tg-migrate#Code reference upgrade#Keep lat]]
// @tg: verifies:: [[openspec:tg-migrate#Code reference upgrade#Keep lat]]
it('keeps the @lat line with --keep-lat', async () => {
  const dir = latProject({ ...BASE, 'src/token.ts': `// ${LAT} [[requirements#Token expiry]]\nexport function refresh() {}\n` });
  await tg(dir, ['migrate', '--no-setup', '--no-since', '--keep-lat']);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'migrated');
  // A second run must not add the typed line again.
  await tg(dir, ['migrate', '--no-setup', '--no-since', '--keep-lat']);
  expect(read(dir, 'src/token.ts')).toBe(`// ${TG} implements:: [[requirements#Token expiry]]\n// ${LAT} [[requirements#Token expiry]]\nexport function refresh() {}\n`);
});

// @lat: [[tests/tg-migrate#Setup swap#lat block replaced]]
// @tg: verifies:: [[openspec:tg-migrate#Setup swap#lat block replaced]]
it('replaces the lat agent block and adds the tg setup', async () => {
  const dir = latProject({ ...BASE, 'CLAUDE.md': '# Notes\n\nKeep me.\n\n%% lat:begin %%\nold\n%% lat:end %%\n' });
  await tg(dir, ['migrate']);
  const claude = read(dir, 'CLAUDE.md');
  expect(claude).toContain('%% tg:begin %%');
  expect(claude).not.toContain('%% lat:begin %%');
  expect(claude.startsWith('# Notes\n\nKeep me.\n')).toBe(true);
  expect(existsSync(join(dir, '.claude/skills/tg-migrate/SKILL.md'))).toBe(true);
  expect(existsSync(join(dir, 'Types/code-types.md'))).toBe(true);
});

// @lat: [[tests/tg-migrate#Migration safety#Dirty file refused]]
// @tg: verifies:: [[openspec:tg-migrate#Migration safety#Dirty file refused]]
it('refuses files with uncommitted changes unless --force', async () => {
  const dir = latProject(withDecisions('Tokens are short because of [[constraints#Session limit]].'));
  writeFileSync(join(dir, 'lat.md/decisions.md'), `${read(dir, 'lat.md/decisions.md')}\nMore.\n`);
  const r = await tg(dir, ['migrate', '--no-setup']);
  expect(r.code).toBe(2);
  expect(r.out).toContain('lat.md/decisions.md');
  expect(read(dir, 'lat.md/decisions.md')).not.toContain('type: Decision');
  expect((await tg(dir, ['migrate', '--no-setup', '--force'])).code).toBe(0);
  expect(read(dir, 'lat.md/decisions.md')).toContain('type: Decision');
});

// @lat: [[tests/tg-migrate#Migration report#JSON for an agent]]
// @tg: verifies:: [[openspec:tg-migrate#Migration report#JSON for an agent]]
it('reports typed files, edges, upgrades and unresolved links as JSON', async () => {
  const dir = latProject(withDecisions('See [[glossary#Session]].'));
  const p = await plan(dir);
  expect(Object.keys(p)).toEqual(expect.arrayContaining(['typed', 'edges', 'upgraded', 'unresolved']));
  expect(Object.keys(p.unresolved[0]!).sort()).toEqual(['candidates', 'file', 'line', 'reason', 'section', 'target', 'text']);
  expect((await tg(dir, ['migrate', '--dry-run'])).out).toContain('Left 1 link plain (no cue 1)');
});

// @lat: [[tests/tg-migrate#Link typing#Words, not substrings]]
// @tg: verifies:: [[openspec:tg-migrate#Link typing#Words, not substrings]]
it('matches cue words as words and keeps link targets whole', async () => {
  const dir = latProject({
    ...withDecisions('A reasonable approach, see [[decisions#Long sessions]].'),
    'lat.md/constraints.md': '# Constraints\n\nRules.\n\n## St. Louis hosting\n\nData stays in St. Louis.\n',
  });
  const p = await plan(dir, '--no-since');
  expect(p.unresolved.find((u) => u.target === 'decisions#Long sessions')?.reason).toBe('ambiguous');
  writeFileSync(join(dir, 'lat.md/decisions.md'), read(dir, 'lat.md/decisions.md').replace('A reasonable approach, see [[decisions#Long sessions]].', 'We host near [[constraints#St. Louis hosting]] because of latency.'));
  git(dir, 'commit', '-qam', 'edit');
  const q = await plan(dir, '--no-since');
  expect(q.edges.map((e) => [e.type, e.target])).toContainEqual(['motivated_by', 'constraints#St. Louis hosting']);
});

it('adds a type to CRLF frontmatter without a second block', async () => {
  const dir = latProject({ ...BASE, 'lat.md/decisions.md': '---\r\nowner: ops\r\n---\r\n# Decisions\r\n\r\nChoices.\r\n' });
  await tg(dir, ['migrate', '--no-setup']);
  expect(read(dir, 'lat.md/decisions.md')).toBe('---\r\ntype: Decision\r\nowner: ops\r\n---\r\n# Decisions\r\n\r\nChoices.\r\n');
});

// @lat: [[tests/tg-migrate#Migration safety#Symlink out of the project]]
// @tg: verifies:: [[openspec:tg-migrate#Migration safety#Symlink out of the project]]
it('refuses to write through a symlink that leads outside the project, even with --force', async () => {
  const outside = mkdtempSync(join(tmpdir(), 'tg-outside-'));
  writeFileSync(join(outside, 'decisions.md'), '# Decisions\n\nChoices.\n\n## Short\n\nShort because of [[constraints#Session limit]].\n');
  const dir = latProject(BASE, false);
  symlinkSync(outside, join(dir, 'lat.md/shared'));
  const before = read(outside, 'decisions.md');
  const r = await tg(dir, ['migrate', '--no-setup', '--force']);
  expect(r.code).toBe(2);
  expect(r.out).toContain('refuses to write through symlinks');
  expect(r.out).toContain('lat.md/shared/decisions.md');
  expect(read(outside, 'decisions.md')).toBe(before);
});
