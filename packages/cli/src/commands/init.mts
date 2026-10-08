import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { EXIT_ERROR, EXIT_OK, register, type Command } from '../cli.mjs';
import { unifiedDiff } from '../diff.mjs';
import { TEMPLATES } from './gen.mjs';

export const BEGIN = '%% tg:begin %%';
export const END = '%% tg:end %%';
const LAT_BEGIN = '%% lat:begin %%';
const LAT_END = '%% lat:end %%';

export interface Change {
  path: string;
  before: string | null;
  after: string;
}

const block = (): string => `${BEGIN}\n${TEMPLATES.agents.trimEnd()}\n${END}\n`;

function between(text: string, begin: string, end: string): { start: number; stop: number } | null {
  const s = text.indexOf(begin);
  const e = text.indexOf(end, s + begin.length);
  return s === -1 || e === -1 ? null : { start: s, stop: e + end.length };
}

/** Put the managed block into an instruction file, replacing a previous tg block and, with `migrate`, a lat block. */
// @tg: implements:: [[openspec:tg-agent-integration#Migration from lat]]
export function withBlock(existing: string | null, migrate: boolean): { text: string; hadLat: boolean } {
  const text = existing ?? '';
  const mine = between(text, BEGIN, END);
  const lat = between(text, LAT_BEGIN, LAT_END);
  const managed = block().trimEnd();
  if (mine) return { text: `${text.slice(0, mine.start)}${managed}${text.slice(mine.stop)}`, hadLat: lat !== null };
  if (lat && migrate) return { text: `${text.slice(0, lat.start)}${managed}${text.slice(lat.stop)}`, hadLat: true };
  const sep = text === '' ? '' : text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
  return { text: `${text}${sep}${managed}\n`, hadLat: lat !== null };
}

interface HookEntry {
  hooks?: { type?: string; command?: string }[];
}

/** Merge tg hooks into a Claude Code settings object without disturbing other entries. */
// @tg: implements:: [[openspec:tg-agent-integration#Migration from lat]]
export function withHooks(settings: Record<string, unknown>, migrate: boolean): Record<string, unknown> {
  const out = JSON.parse(JSON.stringify(settings)) as { hooks?: Record<string, HookEntry[]> };
  out.hooks ??= {};
  for (const [event, command] of [['UserPromptSubmit', 'tg hook claude UserPromptSubmit'], ['Stop', 'tg hook claude Stop']] as const) {
    let entries = out.hooks[event] ?? [];
    if (migrate) {
      entries = entries
        .map((e) => ({ ...e, hooks: e.hooks?.filter((h) => !/^lat hook claude /.test(h.command ?? '')) }))
        .filter((e) => (e.hooks?.length ?? 0) > 0);
    }
    const present = entries.some((e) => e.hooks?.some((h) => h.command === command));
    if (!present) entries.push({ hooks: [{ type: 'command', command }] });
    out.hooks[event] = entries;
  }
  return out;
}

export function withMcp(config: Record<string, unknown>, migrate: boolean): Record<string, unknown> {
  const out = JSON.parse(JSON.stringify(config)) as { mcpServers?: Record<string, unknown> };
  out.mcpServers ??= {};
  out.mcpServers.tg = { command: 'tg', args: ['mcp'] };
  if (migrate) delete out.mcpServers.lat;
  return out;
}

const INDEX = `# Project

This directory defines the high-level concepts, business logic and architecture of the project in markdown, managed with the \`tg\` CLI (compatible with lat.md). Run \`tg check\` to validate it.
`;

const INDEX_ONTOLOGY = `
- [[code-ontology]] — shared vocabulary of intent types and typed edges between intent and code
`;

function readJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function read(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

// @tg: implements:: [[openspec:tg-agent-integration#Bundled skills]]
// @tg: implements:: [[openspec:tg-agent-integration#Safe init]]
export function planInit(root: string, agent: string, migrate: boolean, ontology = true): { changes: Change[]; notes: string[] } {
  const changes: Change[] = [];
  const notes: string[] = [];
  const add = (rel: string, after: string) => {
    const before = read(join(root, rel));
    if (before !== after) changes.push({ path: rel, before, after });
  };
  if (!existsSync(join(root, 'lat.md'))) add('lat.md/lat.md', ontology ? `${INDEX}${INDEX_ONTOLOGY}` : INDEX);
  if (ontology) {
    // Project-owned once written: never overwritten, so local edits to the vocabulary survive a re-run.
    for (const [rel, text] of [['lat.md/code-ontology.md', TEMPLATES.ontologyGuide], ['ontology/code-types.md', TEMPLATES.ontologySchema]] as const) {
      if (!existsSync(join(root, rel))) add(rel, text);
    }
    // The lat.md index must list every file, or `tg check` would fail right after init.
    const index = read(join(root, 'lat.md/lat.md'));
    if (index !== null && !existsSync(join(root, 'lat.md/code-ontology.md')) && !index.includes('[[code-ontology]]')) {
      add('lat.md/lat.md', `${index}${index.endsWith('\n') ? '' : '\n'}${INDEX_ONTOLOGY.trimStart()}`);
    }
  }
  const doc = agent === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
  if (agent === 'cursor') {
    add('.cursor/rules/tg.mdc', TEMPLATES.cursor);
  } else {
    const r = withBlock(read(join(root, doc)), migrate);
    if (r.hadLat && !migrate && !(read(join(root, doc)) ?? '').includes(BEGIN)) notes.push(`${doc} has a lat.md block; it is left in place. Re-run with --migrate --write to replace it with the tg block.`);
    add(doc, r.text);
  }
  if (agent === 'claude') {
    const settingsPath = join(root, '.claude/settings.json');
    add('.claude/settings.json', `${JSON.stringify(withHooks(readJson(settingsPath), migrate), null, 2)}\n`);
    add('.mcp.json', `${JSON.stringify(withMcp(readJson(join(root, '.mcp.json')), migrate), null, 2)}\n`);
    add('.claude/skills/tg-docs/SKILL.md', TEMPLATES.docsSkill);
    add('.claude/skills/tg-graph/SKILL.md', TEMPLATES.graphSkill);
  }
  return { changes, notes };
}

// @tg: implements:: [[openspec:tg-agent-integration#Safe init]]
export const init: Command = {
  name: 'init',
  summary: 'Set up lat.md/, the code ontology, agent instructions, hooks, MCP and skills (dry run unless --write)',
  usage: 'init [dir] [--agent claude|agents|cursor] [--write] [--migrate] [--no-ontology]',
  flags: { write: 'bool', migrate: 'bool', agent: 'string', 'no-ontology': 'bool' },
  noProject: true,
  run(ctx, args, flags) {
    const root = resolve(ctx.cwd, args[0] ?? ctx.root);
    const agent = typeof flags.get('agent') === 'string' ? (flags.get('agent') as string) : 'claude';
    if (!['claude', 'agents', 'cursor'].includes(agent)) {
      ctx.err(`unknown agent "${agent}"; expected claude, agents or cursor\n`);
      return EXIT_ERROR;
    }
    const { changes, notes } = planInit(root, agent, flags.has('migrate'), !flags.has('no-ontology'));
    const write = flags.has('write');
    if (ctx.json) {
      ctx.out(`${JSON.stringify({ root, write, changes: changes.map((c) => ({ path: c.path, created: c.before === null })), notes })}\n`);
    } else if (!changes.length) {
      ctx.out(`${basename(root)} is already set up; nothing to change.\n`);
    } else {
      for (const c of changes) ctx.out(`${unifiedDiff(c.path, c.before, c.after)}\n\n`);
      for (const n of notes) ctx.out(`Note: ${n}\n`);
      ctx.out(write ? `Wrote ${changes.length} file${changes.length === 1 ? '' : 's'}.\n` : `Dry run: ${changes.length} file${changes.length === 1 ? '' : 's'} would change. Re-run with --write to apply.\n`);
    }
    if (write) {
      for (const c of changes) {
        const full = join(root, c.path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, c.after);
      }
    }
    return EXIT_OK;
  },
};

register(init);
