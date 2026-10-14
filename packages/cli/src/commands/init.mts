import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { EXIT_ERROR, EXIT_OK, register, type Command, type Ctx } from '../cli.mjs';
import { unifiedDiff } from '../diff.mjs';
import { DOCS_DIRS, existingDocsDir, type DocsDir } from '../root.mjs';
import { AGENT_IDS, AGENTS, detectAgents, parseAgents, type Agent } from './agents.mjs';
import { ONTOLOGY_TEMPLATES, OPENSPEC_PATCHES, SKILLS, TEMPLATES } from './gen.mjs';
import { withOpenspecRules } from './openspec-config.mjs';

export const BEGIN = '%% tg:begin %%';
export const END = '%% tg:end %%';
const LAT_BEGIN = '%% lat:begin %%';
const LAT_END = '%% lat:end %%';

export interface Change {
  path: string;
  before: string | null;
  after: string;
}

const block = (docs: DocsDir): string => `${BEGIN}\n${forDocs(TEMPLATES.agents, docs).trimEnd()}\n${END}\n`;

/** Template text for a project whose docs folder is `docs`: the bundled text names `lat.md/`. */
// @tg: implements:: [[openspec:tg-agent-integration#Docs folder choice]]
export function forDocs(text: string, docs: DocsDir): string {
  return docs === 'lat.md' ? text : text.replaceAll('lat.md/lat.md', `${docs}/${docs}`).replaceAll('lat.md/', `${docs}/`);
}

function between(text: string, begin: string, end: string): { start: number; stop: number } | null {
  const s = text.indexOf(begin);
  const e = text.indexOf(end, s + begin.length);
  return s === -1 || e === -1 ? null : { start: s, stop: e + end.length };
}

/** Put the managed block into an instruction file, replacing a previous tg block and, with `migrate`, a lat block. */
// @tg: implements:: [[openspec:tg-agent-integration#Migration from lat]]
export function withBlock(existing: string | null, migrate: boolean, docs: DocsDir = 'lat.md'): { text: string; hadLat: boolean } {
  const text = existing ?? '';
  const mine = between(text, BEGIN, END);
  const lat = between(text, LAT_BEGIN, LAT_END);
  const managed = block(docs).trimEnd();
  if (mine) {
    const updated = `${text.slice(0, mine.start)}${managed}${text.slice(mine.stop)}`;
    // A file that already has a tg block (from an earlier init without --migrate) can still hold the lat block: drop it.
    const stale = migrate ? between(updated, LAT_BEGIN, LAT_END) : null;
    if (!stale) return { text: updated, hadLat: lat !== null };
    const after = updated.slice(stale.stop).replace(/^\n+/, '');
    return { text: `${updated.slice(0, stale.start).replace(/\n+$/, '')}${after ? `\n\n${after}` : '\n'}`, hadLat: true };
  }
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

export const OPENSPEC_BEGIN = '<!-- tg:begin -->';
export const OPENSPEC_END = '<!-- tg:end -->';

/** OpenSpec's skill folder and Claude Code command, by the workflow stage each one drives. */
const OPENSPEC_FILES: [keyof typeof OPENSPEC_PATCHES, string, string][] = [
  ['propose', 'openspec-propose', '.claude/commands/opsx/propose.md'],
  ['apply', 'openspec-apply-change', '.claude/commands/opsx/apply.md'],
  ['archive', 'openspec-archive-change', '.claude/commands/opsx/archive.md'],
  ['explore', 'openspec-explore', '.claude/commands/opsx/explore.md'],
];

const OPENSPEC_CONFIG = 'openspec/config.yaml';
const ONTOLOGY_SCHEMA = 'Types/code-types.md';
const LEGACY_ONTOLOGY_SCHEMA = 'ontology/code-types.md';

/** Append or replace the tg block at the end of an OpenSpec skill or command; text outside the block is kept as is. */
// @tg: implements:: [[openspec:tg-agent-integration#OpenSpec skill patching]]
export function withOpenspecBlock(existing: string, patch: string): string {
  const managed = `${OPENSPEC_BEGIN}\n${patch.trimEnd()}\n${OPENSPEC_END}`;
  const mine = between(existing, OPENSPEC_BEGIN, OPENSPEC_END);
  if (mine) return `${existing.slice(0, mine.start)}${managed}${existing.slice(mine.stop)}`;
  const sep = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${sep}${managed}\n`;
}

/** What `tg init` can set up; each part can be chosen or skipped on its own. */
export const PARTS = [
  { id: 'instructions', name: 'Agent instructions (CLAUDE.md, AGENTS.md, Cursor rules)' },
  { id: 'hooks', name: 'Claude Code hooks and the tg MCP server' },
  { id: 'skills', name: 'tg skills for each agent' },
  { id: 'openspec', name: 'OpenSpec: tg steps in its skills, tg rules in openspec/config.yaml' },
  { id: 'ontology', name: 'Code ontology: code-ontology.md in the docs, Types/, Templates/' },
] as const;

export type Part = (typeof PARTS)[number]['id'];
export const PART_IDS: Part[] = PARTS.map((p) => p.id);

export interface InitOptions {
  /** Parts to set up (default all). */
  parts?: Iterable<Part>;
  /** Docs folder to create when the project has none (default `lat.md`); an existing one always wins. */
  docs?: DocsDir;
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
// @tg: implements:: [[openspec:tg-agent-integration#Skills-only init]]
// @tg: implements:: [[openspec:tg-agent-integration#Skills per agent]]
// @tg: implements:: [[openspec:tg-agent-integration#OpenSpec skill patching]]
// @tg: implements:: [[openspec:tg-agent-integration#Setup parts]]
export function planInit(root: string, agents: readonly Agent[], migrate: boolean, options: InitOptions = {}): { changes: Change[]; notes: string[] } {
  const parts = new Set<Part>(options.parts ?? PART_IDS);
  const docs = existingDocsDir(root) ?? options.docs ?? 'lat.md';
  const changes: Change[] = [];
  const notes: string[] = [];
  const add = (rel: string, after: string) => {
    const before = read(join(root, rel));
    if (before !== after) changes.push({ path: rel, before, after });
  };
  const ids = new Set(agents.map((a) => a.id));
  // Codex and generic agents share `.agents/skills`; each folder is handled once.
  const skillDirs = [...new Set(agents.map((a) => a.skills))];

  if ((parts.has('instructions') || parts.has('ontology')) && !existsSync(join(root, docs))) {
    add(`${docs}/${docs}`, parts.has('ontology') ? `${INDEX}${INDEX_ONTOLOGY}` : INDEX);
  }
  if (parts.has('ontology')) planOntology(root, docs, add, notes);
  if (parts.has('instructions')) {
    for (const doc of new Set(agents.map((a) => a.instructions))) {
      if (doc === '.cursor/rules/tg.mdc') {
        add(doc, forDocs(TEMPLATES.cursor, docs));
        continue;
      }
      const r = withBlock(read(join(root, doc)), migrate, docs);
      if (r.hadLat && !migrate && !(read(join(root, doc)) ?? '').includes(BEGIN)) notes.push(`${doc} has a lat.md block; it is left in place. Re-run with --migrate to replace it with the tg block.`);
      add(doc, r.text);
    }
  }
  if (parts.has('hooks') && ids.has('claude')) {
    add('.claude/settings.json', `${JSON.stringify(withHooks(readJson(join(root, '.claude/settings.json')), migrate), null, 2)}\n`);
    add('.mcp.json', `${JSON.stringify(withMcp(readJson(join(root, '.mcp.json')), migrate), null, 2)}\n`);
  }
  if (parts.has('skills')) {
    for (const dir of skillDirs) for (const [name, text] of Object.entries(SKILLS)) add(`${dir}/${name}/SKILL.md`, forDocs(text, docs));
  }
  if (parts.has('openspec')) {
    for (const [stage, skill, command] of OPENSPEC_FILES) {
      const paths = skillDirs.map((dir) => `${dir}/${skill}/SKILL.md`);
      if (ids.has('claude')) paths.push(command);
      for (const rel of paths) {
        const text = read(join(root, rel));
        if (text !== null) add(rel, withOpenspecBlock(text, OPENSPEC_PATCHES[stage]));
      }
    }
    const config = read(join(root, OPENSPEC_CONFIG));
    if (config !== null) {
      const next = withOpenspecRules(config);
      if (next === null) notes.push(`${OPENSPEC_CONFIG} is not a YAML mapping with a rules mapping; tg rules were not added.`);
      else add(OPENSPEC_CONFIG, next);
    }
  }
  return { changes, notes };
}

/**
 * The code ontology: its guide in lat.md, its schema in `Types/` where every
 * host looks for schema notes, and a template per type in `Templates/`. All are
 * project-owned once written, so a re-run never overwrites local edits.
 */
// @tg: implements:: [[openspec:tg-agent-integration#Code ontology install]]
function planOntology(root: string, docs: DocsDir, add: (rel: string, after: string) => void, notes: string[]): void {
  const files: [string, string][] = [
    [`${docs}/code-ontology.md`, forDocs(TEMPLATES.ontologyGuide, docs)],
    [ONTOLOGY_SCHEMA, forDocs(TEMPLATES.ontologySchema, docs)],
    ...Object.entries(ONTOLOGY_TEMPLATES).map(([type, text]): [string, string] => [`Templates/${type}.md`, text]),
  ];
  for (const [rel, text] of files) if (!existsSync(join(root, rel))) add(rel, text);
  if (existsSync(join(root, LEGACY_ONTOLOGY_SCHEMA)) && !existsSync(join(root, ONTOLOGY_SCHEMA))) {
    notes.push(`${LEGACY_ONTOLOGY_SCHEMA} is from an older tg init; tools read schemas from Types/, so delete it once you have moved any edits into ${ONTOLOGY_SCHEMA}.`);
  }
  // The lat.md index must list every file, or `tg check` would fail right after init.
  const indexPath = `${docs}/${docs}`;
  const index = read(join(root, indexPath));
  if (index !== null && !existsSync(join(root, `${docs}/code-ontology.md`)) && !index.includes('[[code-ontology]]')) {
    add(indexPath, `${index}${index.endsWith('\n') ? '' : '\n'}${INDEX_ONTOLOGY.trimStart()}`);
  }
}

/** Agents from `--agent`, else ticked in the terminal, else detected, else Claude Code; null after reporting a bad `--agent`. */
// @tg: implements:: [[openspec:tg-agent-integration#Agent selection]]
async function chooseAgents(ctx: Ctx, root: string, flag: string | true | undefined, interactive: boolean): Promise<Agent[] | null> {
  if (flag !== undefined) {
    const { agents, unknown } = parseAgents(flag === true ? '' : flag);
    if (unknown.length || !agents.length) {
      ctx.err(`unknown agent "${unknown.join(', ') || flag}"; expected one or more of ${AGENT_IDS.join(', ')}, comma-separated\n`);
      return null;
    }
    return agents;
  }
  const detected = detectAgents(root);
  const preselected = new Set((detected.length ? detected : AGENTS.filter((a) => a.id === 'claude')).map((a) => a.id));
  if (!interactive) return AGENTS.filter((a) => preselected.has(a.id));
  const picked = new Set(await ctx.choose!('Coding agents to set up', AGENTS.map((a) => ({ id: a.id, label: a.name, checked: preselected.has(a.id) }))));
  return AGENTS.filter((a) => picked.has(a.id));
}

/** Parts from `--only`, `--skip` and the older opt-out flags, else ticked in the terminal, else all; null after reporting a bad name. */
// @tg: implements:: [[openspec:tg-agent-integration#Setup parts]]
async function chooseParts(ctx: Ctx, root: string, flags: Map<string, string | true>, interactive: boolean): Promise<Part[] | null> {
  const list = (name: string): Part[] | null => {
    const v = flags.get(name);
    if (v === undefined) return [];
    const ids = (v === true ? '' : v).split(',').map((x) => x.trim()).filter(Boolean);
    const bad = ids.filter((id) => !(PART_IDS as string[]).includes(id));
    if (bad.length || !ids.length) {
      ctx.err(`unknown part "${bad.join(', ') || v}" for --${name}; expected ${PART_IDS.join(', ')}, comma-separated\n`);
      return null;
    }
    return ids as Part[];
  };
  const only = list('only');
  const skip = list('skip');
  if (!only || !skip) return null;
  if (flags.has('skills-only')) only.push('skills', 'openspec');
  if (flags.has('no-ontology')) skip.push('ontology');
  if (flags.has('no-openspec')) skip.push('openspec');
  const given = flags.has('only') || flags.has('skip') || flags.has('skills-only') || flags.has('no-ontology') || flags.has('no-openspec');
  if (given) return (only.length ? only : PART_IDS).filter((p) => !skip.includes(p));
  if (!interactive) return [...PART_IDS];
  // OpenSpec is offered ticked only when the project uses it.
  const usesOpenspec = existsSync(join(root, 'openspec'));
  const picked = await ctx.choose!('What to set up or update', PARTS.map((p) => ({ id: p.id, label: p.name, checked: p.id !== 'openspec' || usesOpenspec })));
  return PART_IDS.filter((p) => picked.includes(p));
}

/**
 * The docs folder: the existing one (`lat.md/` first), else `--docs`, else
 * asked in the terminal when init will create it, else `lat.md`. Null after
 * reporting a bad `--docs`.
 */
// @tg: implements:: [[openspec:tg-agent-integration#Docs folder choice]]
async function chooseDocs(ctx: Ctx, root: string, flag: string | true | undefined, ask: boolean): Promise<{ dir: DocsDir; notes: string[] } | null> {
  if (flag !== undefined && !(DOCS_DIRS as readonly unknown[]).includes(flag)) {
    ctx.err(`unknown docs folder "${flag === true ? '' : flag}"; expected ${DOCS_DIRS.join(' or ')}\n`);
    return null;
  }
  const existing = existingDocsDir(root);
  if (existing) return { dir: existing, notes: flag && flag !== existing ? [`${existing}/ already exists and is used; --docs ${flag} applies only to projects without a docs folder.`] : [] };
  if (flag) return { dir: flag as DocsDir, notes: [] };
  if (!ask) return { dir: 'lat.md', notes: [] };
  const dir = (await ctx.select!('Docs folder to create', [
    { id: 'lat.md', label: 'lat.md/  (also works with the lat command)' },
    { id: 'tg.md', label: 'tg.md/' },
  ])) as DocsDir;
  return { dir, notes: [] };
}

// @tg: implements:: [[openspec:tg-agent-integration#Safe init]]
// @tg: implements:: [[openspec:tg-agent-integration#Interactive setup]]
// @tg: implements:: [[openspec:tg-agent-integration#Migration from lat]]
export const init: Command = {
  name: 'init',
  summary: 'Set up the docs folder (lat.md/ or tg.md/), the code ontology, agent instructions, hooks, MCP, skills and OpenSpec rules for your coding agents (asks in a terminal; --dry-run only prints the diff)',
  usage: `init [dir] [--agent ${AGENT_IDS.join('|')}[,...]] [--only|--skip ${PART_IDS.join('|')}[,...]] [--docs ${DOCS_DIRS.join('|')}] [--dry-run] [--yes] [--migrate] [--no-ontology] [--no-openspec] [--skills-only]`,
  flags: { docs: 'string', 'dry-run': 'bool', write: 'bool', yes: 'bool', migrate: 'bool', agent: 'string', only: 'string', skip: 'string', 'no-ontology': 'bool', 'no-openspec': 'bool', 'skills-only': 'bool' },
  noProject: true,
  async run(ctx, args, flags) {
    // Init sets up the folder it is pointed at, never a parent: a stray docs folder higher up must not capture it.
    const root = resolve(ctx.cwd, args[0] ?? (flags.has('dir') ? ctx.root : '.'));
    // `--yes` and `--json` are for scripts: no checklist, no confirmation.
    const interactive = !!ctx.choose && !!ctx.select && !ctx.json && !flags.has('yes');
    const agents = await chooseAgents(ctx, root, flags.get('agent'), interactive);
    if (!agents) return EXIT_ERROR;
    const parts = await chooseParts(ctx, root, flags, interactive);
    if (!parts) return EXIT_ERROR;
    if (!agents.length || !parts.length) {
      ctx.out('Nothing selected; nothing to do.\n');
      return EXIT_OK;
    }
    const docs = await chooseDocs(ctx, root, flags.get('docs'), interactive && (parts.includes('instructions') || parts.includes('ontology')));
    if (!docs) return EXIT_ERROR;
    const { changes, notes } = planInit(root, agents, flags.has('migrate'), { parts, docs: docs.dir });
    notes.unshift(...docs.notes);
    // Writing is the default; `--dry-run` only prints the diff. `--write` is accepted for older scripts and changes nothing.
    const write = !flags.has('dry-run');
    const files = `${changes.length} file${changes.length === 1 ? '' : 's'}`;
    if (ctx.json) {
      ctx.out(`${JSON.stringify({ root, write, agents: agents.map((a) => a.id), parts, docs: docs.dir, changes: changes.map((c) => ({ path: c.path, created: c.before === null })), notes })}\n`);
    } else if (!changes.length) {
      ctx.out(`${basename(root)} is already set up; nothing to change.\n`);
    } else if (!write) {
      for (const c of changes) ctx.out(`${unifiedDiff(c.path, c.before, c.after)}\n\n`);
      for (const n of notes) ctx.out(`Note: ${n}\n`);
      ctx.out(`Dry run: ${files} would change. Run tg init without --dry-run to apply.\n`);
    } else {
      // Colors only for a person at a terminal; scripts get plain lines.
      const [created, updated] = interactive ? ['\x1b[32m+ created\x1b[0m', '\x1b[33m~ updated\x1b[0m'] : ['+ created', '~ updated'];
      for (const c of changes) ctx.out(`  ${c.before === null ? created : updated} ${c.path}\n`);
      for (const n of notes) ctx.out(`Note: ${n}\n`);
      ctx.out(`Wrote ${files}.\n`);
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
