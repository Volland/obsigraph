import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { run, type Io } from '../src/cli.mjs';
import '../src/commands/index.mjs';

function project(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-docs-'));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}

/** Run tg; with `picked`, as a person at a terminal who keeps the default checklists and picks the given docs folder. */
async function tg(cwd: string, args: string[], picked?: string, stdin = '') {
  let out = '';
  const asked: string[] = [];
  const io: Io = { cwd, out: (t) => (out += t), err: (t) => (out += t), env: {}, stdin: () => stdin };
  if (picked) {
    io.choose = async (_, items) => items.filter((i) => i.checked).map((i) => i.id);
    io.ask = async () => '';
    io.select = async (title) => {
      asked.push(title);
      return picked;
    };
  }
  const code = await run(args, io);
  return { code, out, asked };
}

// Split so `tg check` on this repository does not read the fixture as an annotation.
const LAT = '@' + 'lat:';

const read = (dir: string, rel: string) => readFileSync(join(dir, rel), 'utf8');
const TG_DOCS = {
  'tg.md/tg.md': '# Docs\n\nIndex.\n\n- [[auth]] — auth\n',
  'tg.md/auth.md': '# Auth\n\nHow login works.\n\n## Login\n\nCredentials are checked.\n',
};

// @lat: [[tests/cli-core#Project root discovery#tg.md project]]
// @tg: verifies:: [[openspec:tg-cli#Project root discovery#tg.md project]]
it('finds the root of a tg.md project from a subdirectory', async () => {
  const dir = project({ ...TG_DOCS, 'src/a.ts': 'export const a = 1;\n' });
  const r = await tg(join(dir, 'src'), ['check']);
  expect(r.out).toContain('All checks passed');
  expect(r.code).toBe(0);
});

// @lat: [[tests/cli-core#Docs folder#tg.md sections]]
// @tg: verifies:: [[openspec:tg-cli#Docs folder#tg.md sections]]
it('reads sections, ids, index and annotations from tg.md', async () => {
  const dir = project({ ...TG_DOCS, 'src/login.ts': `// ${LAT} [[auth#Login]]\nexport function login() {}\n` });
  const section = await tg(dir, ['section', 'auth#Login', '--json']);
  expect(section.out).toContain('"id":"tg.md/auth#Auth#Login"');
  const check = await tg(dir, ['check']);
  expect(check.out).toContain('All checks passed');
  writeFileSync(join(dir, 'tg.md/extra.md'), '# Extra\n\nNot listed in the index.\n');
  expect((await tg(dir, ['check'])).out).toContain('"tg.md" is missing entries');
});

// @lat: [[tests/cli-core#Docs folder#lat.md wins]]
// @tg: verifies:: [[openspec:tg-cli#Docs folder#lat.md wins]]
it('reads lat.md and ignores tg.md when both exist', async () => {
  const dir = project({ ...TG_DOCS, 'lat.md/lat.md': '# Lat\n\nIndex.\n\n- [[billing]] — billing\n', 'lat.md/billing.md': '# Billing\n\nInvoices.\n' });
  expect((await tg(dir, ['section', 'billing', '--json'])).out).toContain('lat.md/billing');
  expect((await tg(dir, ['section', 'auth#Login'])).code).not.toBe(0);
});

// @lat: [[tests/cli-core#Docs folder#Hook names the folder]]
it('names the tg.md folder in hook messages', async () => {
  const dir = project(TG_DOCS);
  const r = await tg(dir, ['hook', 'claude', 'UserPromptSubmit'], undefined, JSON.stringify({ prompt: 'login' }));
  expect(r.out).toContain('`tg.md/` must stay in sync');
  expect(r.out).not.toContain('lat.md/');
});

// @lat: [[tests/tg-agent#Docs folder choice#Asked in a terminal]]
// @tg: verifies:: [[openspec:tg-agent-integration#Docs folder choice#Asked in a terminal]]
it('asks which docs folder to create and installs files for tg.md', async () => {
  const dir = project();
  const r = await tg(dir, ['init'], 'tg.md');
  expect(r.asked).toEqual(['Docs folder to create']);
  expect(read(dir, 'tg.md/tg.md')).toContain('[[code-ontology]]');
  expect(read(dir, 'CLAUDE.md')).toContain('`tg.md/`');
  expect(read(dir, 'CLAUDE.md')).not.toContain('`lat.md/`');
  expect(read(dir, '.claude/skills/tg-docs/SKILL.md')).toContain('tg.md/tg.md');
  expect(existsSync(join(dir, 'lat.md'))).toBe(false);
  const check = await tg(dir, ['check']);
  expect(check.out).toContain('All checks passed');
});

// @lat: [[tests/tg-agent#Docs folder choice#Flag for scripts]]
// @tg: verifies:: [[openspec:tg-agent-integration#Docs folder choice#Flag for scripts]]
it('creates tg.md with --docs tg.md and rejects an unknown folder', async () => {
  const dir = project();
  await tg(dir, ['init', '--docs', 'tg.md', '--write']);
  expect(existsSync(join(dir, 'tg.md/tg.md'))).toBe(true);
  expect(existsSync(join(dir, 'tg.md/code-ontology.md'))).toBe(true);
  expect(existsSync(join(dir, 'lat.md'))).toBe(false);
  expect((await tg(project(), ['init', '--docs', 'docs'])).code).toBe(2);
});

// @lat: [[tests/tg-agent#Docs folder choice#Existing lat.md kept]]
// @tg: verifies:: [[openspec:tg-agent-integration#Docs folder choice#Existing lat.md kept]]
it('keeps an existing lat.md folder and says so when --docs asks for tg.md', async () => {
  const dir = project({ 'lat.md/lat.md': '# Lat\n\nIndex.\n' });
  const r = await tg(dir, ['init', '--docs', 'tg.md', '--write']);
  expect(r.out).toContain('lat.md/ already exists and is used');
  expect(existsSync(join(dir, 'tg.md'))).toBe(false);
  expect(read(dir, 'CLAUDE.md')).toContain('`lat.md/`');
  // An existing folder is never asked about.
  const again = await tg(project({ 'tg.md/tg.md': '# Docs\n\nIndex.\n' }), ['init'], 'lat.md');
  expect(again.asked).toEqual([]);
});

// @lat: [[tests/tg-agent#Docs folder choice#Default without a terminal]]
// @tg: verifies:: [[openspec:tg-agent-integration#Docs folder choice#Default without a terminal]]
it('plans lat.md without asking outside a terminal', async () => {
  const r = await tg(project(), ['init', '--json']);
  const plan = JSON.parse(r.out) as { docs: string; changes: { path: string }[] };
  expect(plan.docs).toBe('lat.md');
  expect(plan.changes.map((c) => c.path)).toContain('lat.md/lat.md');
});
