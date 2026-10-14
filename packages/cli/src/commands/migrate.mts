import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { isSpecTarget, LatIndex, parseMarkdown, readSchemaNote, schemaSetFromNotes, splitFrontmatter, type EdgeTypeSchema, type SchemaSet, type Section, type SpecIndex } from '@obsigraph/core';
import { parse as parseYaml } from 'yaml';
import { EXIT_ERROR, EXIT_OK, register, type Command, type Ctx } from '../cli.mjs';
import { unifiedDiff } from '../diff.mjs';
import { NoLatDir, Project } from '../project.mjs';
import { existingDocsDir, type DocsDir } from '../root.mjs';
import { AGENTS, detectAgents } from './agents.mjs';
import { TEMPLATES } from './gen.mjs';
import { planInit, type Change } from './init.mjs';
import { readSchemaNotes } from './schema.mjs';

const USAGE = 'migrate [dir] [--dry-run] [--json] [--infer] [--keep-lat] [--no-setup] [--no-since] [--force]';
// Split so tg check does not read these patterns in this file as annotations.
const LAT = '@' + 'lat:';
const TG = '@' + 'tg:';

// ---- ontology -----------------------------------------------------------------

/** The project's ontology from `Types/`, or the bundled code ontology when it has none. */
// @tg: implements:: [[openspec:tg-migrate#Migrate command]]
export function migrationOntology(root: string): SchemaSet {
  const notes = readSchemaNotes(root, 'Types/');
  const set = schemaSetFromNotes(notes.map((n) => readSchemaNote(n.path, n.frontmatter)));
  if (set.schemas.size + set.edgeTypes.size > 0) return set;
  const { yaml } = splitFrontmatter(TEMPLATES.ontologySchema);
  const fm = parseYaml(yaml ?? '') as Record<string, unknown>;
  return schemaSetFromNotes([readSchemaNote('Types/code-types.md', fm)]);
}

// ---- file typing ----------------------------------------------------------------

const PATH_TYPES: [RegExp, string][] = [
  [/^(decisions?|adrs?)$|^adr-/, 'Decision'],
  [/^(requirements?|reqs)$/, 'Requirement'],
  [/^(tests|scenarios)$/, 'Scenario'],
  [/^(constraints?|polic(y|ies)|compliance)$/, 'Constraint'],
  [/^(glossary|concepts|terms|terminology)$/, 'Concept'],
  [/^(changes|changelog)$/, 'Change'],
];

const SHALL = /\b(SHALL|MUST)\b/;

/** The type a docs file's path or content names, or null. `rel` is relative to the docs folder. */
// @tg: implements:: [[openspec:tg-migrate#File typing]]
export function inferFileType(rel: string, sections: Section[]): string | null {
  const parts = rel.replace(/\.md$/, '').toLowerCase().split('/');
  // Most specific first: the file name, then its folders from the innermost out.
  for (const part of [...parts].reverse()) for (const [re, type] of PATH_TYPES) if (re.test(part)) return type;
  const body = sections.filter((s) => s.depth > 1);
  if (body.length && body.filter((s) => SHALL.test(s.firstParagraph)).length * 2 > body.length) return 'Requirement';
  return null;
}

/** An index file is named after its folder: `lat.md/lat.md`, `lat.md/tests/tests.md`. */
function isIndexFile(path: string, docs: DocsDir): boolean {
  const parts = path.split('/');
  const name = parts[parts.length - 1]!;
  const folder = parts[parts.length - 2]!;
  return folder === docs ? name === docs : name === `${folder}.md`;
}

function withType(text: string, type: string): string {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  if (text.startsWith(`---${nl}`)) return `---${nl}type: ${type}${nl}${text.slice(3 + nl.length)}`;
  return `---${nl}type: ${type}${nl}---${nl}${text}`;
}

// ---- link typing ----------------------------------------------------------------

/** Cue words for the bundled edge types; every edge type also cues on the longer words of its own name. */
const CUES: Record<string, string[]> = {
  motivated_by: ['because', 'due to', 'driven by', 'reason', 'reasons', 'motivat*'],
  supersedes: ['replace*', 'supersede*', 'instead of', 'no longer'],
  contradicts: ['contradict*', 'conflict*', 'violate*', 'despite'],
  refines: ['refine*', 'more specific', 'narrow*'],
  depends_on: ['depends on', 'requires', 'needs'],
  constrains: ['constrain*', 'limits', 'bound by', 'must', 'shall', 'required', 'should'],
  defines: ['defines', 'definition', 'means'],
};
/** Edges that say something is wrong; never inferred without saying so. */
const NEGATIVE = new Set(['contradicts']);

function cuesOf(type: string): string[] {
  const words = type.split(/[_\s-]+/).filter((w) => w.length > 3).map((w) => w.toLowerCase());
  return [...(CUES[type] ?? []), ...words];
}

/** A cue matches as whole words; a trailing `*` makes it a stem (`motivat*` matches motivated, motivation). */
function cueRegex(cue: string): RegExp {
  const stem = cue.endsWith('*');
  const words = (stem ? cue.slice(0, -1) : cue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`\\b${words}${stem ? '' : '\\b'}`, 'i');
}

function hasCue(type: string, line: string): boolean {
  return cuesOf(type).some((c) => cueRegex(c).test(line));
}

/** The sentence of `line` that contains the link to `target`: cue words elsewhere on the line say nothing about it. */
export function sentenceOf(line: string, target: string): string {
  const at = line.indexOf(`[[${target}`);
  if (at === -1) return line;
  const before = line.slice(0, at);
  const start = Math.max(before.lastIndexOf('. '), before.lastIndexOf('; '), before.lastIndexOf('! '), before.lastIndexOf('? '));
  const rest = line.slice(at);
  // A period inside the link target (`[[glossary#St. Louis]]`) does not end the sentence.
  const close = Math.max(0, rest.indexOf(']]'));
  const ends = ['. ', '; ', '! ', '? '].map((m) => rest.indexOf(m, close)).filter((i) => i !== -1);
  return line.slice(start === -1 ? 0 : start + 2, ends.length ? at + Math.min(...ends) + 1 : line.length);
}

/**
 * The clause of the link's sentence that cue words may come from: the
 * innermost parenthesized group holding the link, or else the part of the
 * sentence between colons or parenthesized groups that holds it. A cue far
 * away in a long sentence says nothing about this link.
 */
export function clauseOf(sentence: string, target: string): string {
  const at = sentence.indexOf(`[[${target}`);
  if (at === -1) return sentence;
  const close = sentence.indexOf(']]', at);
  const end = close === -1 ? at : close + 2;
  // Innermost enclosing parentheses, if any.
  let depth = 0;
  let open = -1;
  for (let i = at - 1; i >= 0; i--) {
    const c = sentence[i];
    if (c === ')') depth++;
    else if (c === '(') {
      if (depth === 0) {
        open = i;
        break;
      }
      depth--;
    }
  }
  if (open !== -1) {
    const shut = sentence.indexOf(')', end);
    return sentence.slice(open + 1, shut === -1 ? sentence.length : shut);
  }
  const cut = (i: number) => i !== -1;
  const left = Math.max(sentence.lastIndexOf(': ', at), sentence.lastIndexOf(')', at), sentence.lastIndexOf('(', at));
  const rights = [sentence.indexOf(': ', end), sentence.indexOf('(', end)].filter(cut);
  return sentence.slice(left === -1 ? 0 : left + 1, rights.length ? Math.min(...rights) : sentence.length);
}

export type RelationChoice = { chosen: EdgeTypeSchema | null; candidates: string[]; cued: boolean };

/**
 * Edge types the ontology allows from any of `from` to any of `to`, and the
 * one to apply: the single candidate whose cue words the sentence contains,
 * or with `infer`, the single candidate even without a cue.
 */
// @tg: implements:: [[openspec:tg-migrate#Link typing]]
export function chooseRelation(set: SchemaSet, from: string[], to: string[], sentence: string, infer = false): RelationChoice {
  const all = [...set.edgeTypes.values()].filter((e) => (!e.from || e.from.some((t) => from.includes(t))) && (!e.to || e.to.some((t) => to.includes(t))));
  // A negative edge, or one open on either end, is only a candidate when the sentence names it.
  const candidates = all.filter((e) => (!NEGATIVE.has(e.type) && e.from && e.to) || hasCue(e.type, sentence));
  const names = candidates.map((e) => e.type);
  const cued = candidates.filter((e) => hasCue(e.type, sentence));
  if (cued.length === 1) return { chosen: cued[0]!, candidates: names, cued: true };
  if (infer && candidates.length === 1) return { chosen: candidates[0]!, candidates: names, cued: false };
  return { chosen: null, candidates: names, cued: false };
}

// ---- metadata -------------------------------------------------------------------

/** Line (1-based) to the `YYYY-MM-DD` date of the commit that last changed it; empty outside git or for uncommitted lines. */
function blameDates(root: string, rel: string): Map<number, string> {
  const out = new Map<number, string>();
  let text: string;
  try {
    text = execFileSync('git', ['blame', '--line-porcelain', '--', rel], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return out;
  }
  let line = 0;
  let time = '';
  let committed = true;
  for (const l of text.split('\n')) {
    const head = /^[0-9a-f]{40} \d+ (\d+)/.exec(l);
    if (head) {
      line = Number(head[1]);
      committed = !l.startsWith('0000000000000000000000000000000000000000');
    } else if (l.startsWith('author-time ')) time = new Date(Number(l.slice(12)) * 1000).toISOString().slice(0, 10);
    else if (l.startsWith('\t') && committed && time) out.set(line, time);
  }
  return out;
}

function strengthOf(line: string): string | null {
  if (/\b(MUST|SHALL|required|must)\b/.test(line)) return 'must';
  if (/\b(should|recommended)\b/i.test(line)) return 'should';
  return null;
}

function levelOf(path: string): string {
  if (/(^|\/)e2e(\/|\.|$)/i.test(path)) return 'e2e';
  if (/(^|\/)integration(\/|\.|$)/i.test(path)) return 'integration';
  return 'unit';
}

/** The properties of `edge` that the migration can fill and the edge type declares. */
// @tg: implements:: [[openspec:tg-migrate#Edge metadata]]
export function edgeProps(edge: EdgeTypeSchema, facts: { since?: string; line: string; path: string }): Record<string, string> {
  const declared = new Set(edge.properties.map((p) => p.name));
  const out: Record<string, string> = {};
  if (declared.has('since') && facts.since) out.since = facts.since;
  const strength = declared.has('strength') ? strengthOf(facts.line) : null;
  if (strength && edge.properties.find((p) => p.name === 'strength')?.values?.includes(strength) !== false) out.strength = strength;
  if (declared.has('level') && edge.type === 'verifies') out.level = levelOf(facts.path);
  return out;
}

function propBlock(props: Record<string, string>): string {
  const entries = Object.entries(props);
  if (!entries.length) return '';
  return ` {${entries.map(([k, v]) => `${k}: ${/^[A-Za-z][\w-]*$/.test(v) ? v : JSON.stringify(v)}`).join(', ')}}`;
}

// ---- plan -----------------------------------------------------------------------

export interface MigrationEdge {
  file: string;
  line: number;
  section: string;
  type: string;
  target: string;
  props: Record<string, string>;
}

export interface Unresolved {
  file: string;
  line: number;
  section: string;
  target: string;
  reason: 'untyped source' | 'untyped target' | 'no candidate' | 'no cue' | 'ambiguous';
  candidates: string[];
  text: string;
}

export interface MigrationPlan {
  changes: Change[];
  typed: { file: string; type: string }[];
  edges: MigrationEdge[];
  upgraded: { file: string; line: number; type: string; target: string }[];
  unresolved: Unresolved[];
  notes: string[];
}

const TEST_CALL = /^\s*(?:it|test|describe)(?:\.\w+)*\s*\(/;
const LAT_LINE = new RegExp(`^(\\s*)(//+|#+)\\s*${LAT}\\s*\\[\\[([^\\]]+)\\]\\]\\s*$`);

export interface MigrateOptions {
  setup?: boolean;
  since?: boolean;
  keepLat?: boolean;
  /** Also apply a single candidate relation when its sentence has no cue word. */
  infer?: boolean;
}

/** Everything `tg migrate` would change, without touching the disk. */
// @tg: implements:: [[openspec:tg-migrate#Migrate command]]
// @tg: implements:: [[openspec:tg-migrate#Migration report]]
export function planMigration(project: Project, options: MigrateOptions = {}): MigrationPlan {
  const { setup = true, since = true, keepLat = false, infer = false } = options;
  const root = project.root;
  const docs = project.latDirName;
  const plan: MigrationPlan = { changes: [], typed: [], edges: [], upgraded: [], unresolved: [], notes: [] };

  if (setup) {
    const agents = detectAgents(root);
    const setupPlan = planInit(root, agents.length ? agents : AGENTS.filter((a) => a.id === 'claude'), true, { docs });
    plan.changes.push(...setupPlan.changes);
    plan.notes.push(...setupPlan.notes);
  }
  const set = migrationOntology(root);
  const specs: SpecIndex | null = project.specIndex();
  const dates = new Map<string, Map<number, string>>();
  const dateOf = (rel: string, line: number): string | undefined => {
    if (!since) return undefined;
    if (!dates.has(rel)) dates.set(rel, blameDates(root, rel));
    return dates.get(rel)!.get(line);
  };

  // 1. File types: existing ones, else inferred from path or content.
  const texts = new Map(project.mdFiles().map((p) => [p, project.text(p) ?? '']));
  const fileTypes = new Map<string, string[]>();
  for (const [path, text] of texts) {
    if (isIndexFile(path, docs)) continue;
    const parsed = parseMarkdown(path, text);
    if (parsed.frontmatter.types?.length) {
      fileTypes.set(path, parsed.frontmatter.types);
      continue;
    }
    const type = inferFileType(path.slice(docs.length + 1), parsed.flat);
    if (type) {
      fileTypes.set(path, [type]);
      plan.typed.push({ file: path, type });
    }
  }

  // 2. Links: typed edge lines per section.
  const index = new LatIndex([...texts].map(([path, text]) => ({ path, text })));
  const labelsOfSection = (s: Section): string[] => (s.depth > 1 ? (fileTypes.get(s.filePath) ?? []) : []);
  const targetLabels = (target: string): string[] => {
    // Only `openspec:` targets are requirements; the spec index would also read `file#Heading` as one.
    const spec = isSpecTarget(target) ? specs?.resolve(target) : undefined;
    if (spec?.kind === 'requirement') return ['Requirement'];
    if (spec?.kind === 'scenario') return ['Scenario'];
    const r = index.resolve(target);
    if (r.kind === 'section') return labelsOfSection(r.section);
    if (r.kind === 'code') return [r.symbol ? 'CodeSymbol' : 'CodeFile'];
    return [];
  };
  const newText = new Map(texts);
  for (const [path, file] of index.files) {
    if (isIndexFile(path, docs)) continue;
    const lines = (texts.get(path) ?? '').split('\n');
    const edgeLines = new Set(file.edges.map((e) => e.line + 1));
    const typedTargets = new Map<string, Set<string>>();
    for (const e of file.edges) {
      const owner = file.flat.filter((s) => s.startLine <= e.line + 1 && e.line + 1 <= s.endLine).sort((a, b) => b.depth - a.depth)[0];
      if (owner) (typedTargets.get(owner.id) ?? typedTargets.set(owner.id, new Set()).get(owner.id)!).add(e.subpath ? `${e.target}#${e.subpath}` : e.target);
    }
    const additions = new Map<Section, string[]>();
    for (const ref of file.refs) {
      if (!ref.fromSection || edgeLines.has(ref.line)) continue;
      const section = file.flat.find((s) => s.id === ref.fromSection);
      if (!section || section.depth === 1) continue;
      const done = typedTargets.get(section.id) ?? typedTargets.set(section.id, new Set()).get(section.id)!;
      if (done.has(ref.target)) continue;
      const text = lines[ref.line - 1] ?? '';
      const base = { file: path, line: ref.line, section: section.id, target: ref.target, text: text.trim() };
      const from = labelsOfSection(section);
      if (!from.length) {
        plan.unresolved.push({ ...base, reason: 'untyped source', candidates: [] });
        continue;
      }
      const to = targetLabels(ref.target);
      if (!to.length) {
        plan.unresolved.push({ ...base, reason: 'untyped target', candidates: [] });
        continue;
      }
      const sentence = sentenceOf(text, ref.target);
      const clause = clauseOf(sentence, ref.target);
      const { chosen, candidates } = chooseRelation(set, from, to, clause, infer);
      if (!chosen) {
        plan.unresolved.push({ ...base, text: sentence.trim(), reason: candidates.length === 0 ? 'no candidate' : candidates.length === 1 ? 'no cue' : 'ambiguous', candidates });
        continue;
      }
      done.add(ref.target);
      const props = edgeProps(chosen, { since: dateOf(path, ref.line), line: clause, path });
      const sign = NEGATIVE.has(chosen.type) ? '-' : '';
      (additions.get(section) ?? additions.set(section, []).get(section)!).push(`- ${sign}${chosen.type}:: [[${ref.target}]]${propBlock(props)}`);
      plan.edges.push({ ...base, type: chosen.type, props });
    }
    // Insert bottom-up so earlier line numbers stay valid.
    const out = [...lines];
    for (const [section, add] of [...additions].sort((a, b) => b[0].startLine - a[0].startLine)) {
      let end = Math.min(section.endLine, ...section.children.map((c) => c.startLine - 1));
      while (end > section.startLine && !out[end - 1]!.trim()) end--;
      const block = ['', ...add];
      if (end < out.length && out[end]!.trim()) block.push('');
      out.splice(end, 0, ...block);
    }
    if (additions.size) newText.set(path, out.join('\n'));
  }
  for (const t of plan.typed) newText.set(t.file, withType(newText.get(t.file)!, t.type));
  for (const [path, text] of newText) if (text !== texts.get(path)) plan.changes.push({ path, before: texts.get(path)!, after: text });

  // 3. Code: @lat comments to typed @tg edges where the target's type decides.
  const implementsType = set.edgeTypes.get('implements');
  const verifiesType = set.edgeTypes.get('verifies');
  for (const rel of project.sourceFiles()) {
    const text = project.text(rel);
    if (!text || !text.includes(LAT)) continue;
    const lines = text.split('\n');
    const out: string[] = [];
    let changed = false;
    lines.forEach((l, i) => {
      const m = LAT_LINE.exec(l);
      if (!m) return void out.push(l);
      const [, indent, marker, target] = m;
      const labels = targetLabels(target!);
      const nextCode = lines.slice(i + 1).find((x) => x.trim() && !/^\s*(\/\/|#)/.test(x)) ?? '';
      const testCall = TEST_CALL.test(nextCode);
      const edge = labels.includes('Scenario') || (testCall && labels.includes('Requirement')) ? verifiesType : labels.some((t) => t === 'Requirement' || t === 'Decision') ? implementsType : undefined;
      if (!edge || (edge.to && !edge.to.some((t) => labels.includes(t)))) return void out.push(l);
      // With --keep-lat a previous run left the typed line just above; do not add it again.
      if (keepLat && (lines[i - 1] ?? '').includes(`${TG} ${edge.type}:: [[${target}]]`)) return void out.push(l);
      const props = edgeProps(edge, { since: dateOf(rel, i + 1), line: l, path: rel });
      const upgraded = `${indent}${marker} ${TG} ${edge.type}:: [[${target}]]${propBlock(props)}`;
      out.push(upgraded);
      if (keepLat) out.push(l);
      plan.upgraded.push({ file: rel, line: i + 1, type: edge.type, target: target! });
      changed = true;
    });
    if (changed) plan.changes.push({ path: rel, before: text, after: out.join('\n') });
  }
  return plan;
}

// ---- command --------------------------------------------------------------------

/** Paths among `paths` with uncommitted changes (modified, staged or untracked) in git; empty outside git. */
// @tg: implements:: [[openspec:tg-migrate#Migration safety]]
function dirtyPaths(root: string, paths: string[]): string[] | null {
  if (!paths.length) return [];
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: 'ignore' });
  } catch {
    return []; // not a git repository: nothing to protect from git's point of view
  }
  const dirty: string[] = [];
  // Batches keep the command line short; any failure means the guard cannot vouch for the files.
  for (let i = 0; i < paths.length; i += 200) {
    try {
      const out = execFileSync('git', ['status', '--porcelain', '-z', '--', ...paths.slice(i, i + 200)], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const entries = out.split('\0').filter(Boolean);
      for (let j = 0; j < entries.length; j++) {
        const e = entries[j]!;
        dirty.push(e.slice(3));
        if (e[0] === 'R' || e[0] === 'C') j++; // the rename source follows as its own entry
      }
    } catch {
      return null;
    }
  }
  return dirty;
}

/** Paths whose real location is outside `root`, through a symlink: the migration must never write there. */
// @tg: implements:: [[openspec:tg-migrate#Migration safety]]
function outsideRoot(root: string, paths: string[]): string[] {
  const base = realpathSync(root);
  const inside = (p: string) => p === base || p.startsWith(`${base}${sep}`);
  return paths.filter((rel) => {
    // The deepest existing ancestor decides where a write really lands.
    let probe = join(root, rel);
    while (!existsSync(probe)) probe = dirname(probe);
    return !inside(realpathSync(probe));
  });
}

function summary(plan: MigrationPlan): string[] {
  const byType = new Map<string, number>();
  for (const e of plan.edges) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  const left = new Map<string, number>();
  for (const u of plan.unresolved) left.set(u.reason, (left.get(u.reason) ?? 0) + 1);
  return [
    `Typed ${plan.typed.length} file${plan.typed.length === 1 ? '' : 's'}${plan.typed.length ? `: ${plan.typed.map((t) => `${t.file} → ${t.type}`).join(', ')}` : ''}.`,
    `Added ${plan.edges.length} typed edge${plan.edges.length === 1 ? '' : 's'}${byType.size ? ` (${[...byType].map(([t, n]) => `${t} ${n}`).join(', ')})` : ''}.`,
    `Upgraded ${plan.upgraded.length} ${LAT} comment${plan.upgraded.length === 1 ? '' : 's'} to typed ${TG} edges.`,
    `Left ${plan.unresolved.length} link${plan.unresolved.length === 1 ? '' : 's'} plain${left.size ? ` (${[...left].map(([r, n]) => `${r} ${n}`).join(', ')})` : ''}.`,
  ];
}

// @tg: implements:: [[openspec:tg-migrate#Migrate command]]
// @tg: implements:: [[openspec:tg-migrate#Migration safety]]
// @tg: implements:: [[openspec:tg-migrate#Migration report]]
// @tg: implements:: [[openspec:tg-migrate#Setup swap]]
export const migrate: Command = {
  name: 'migrate',
  summary: 'Migrate a lat.md project to an ontology-aware tg project: type files, turn links into typed edges with metadata, upgrade @lat comments, swap the agent setup',
  usage: USAGE,
  flags: { 'dry-run': 'bool', infer: 'bool', 'keep-lat': 'bool', 'no-setup': 'bool', 'no-since': 'bool', force: 'bool' },
  noProject: true,
  run(ctx: Ctx, args, flags) {
    const root = resolve(ctx.cwd, args[0] ?? '.');
    if (!existingDocsDir(root)) {
      ctx.err(`${root} has no lat.md/ or tg.md/ docs folder; nothing to migrate. Run tg init to start one.\n`);
      return EXIT_ERROR;
    }
    let project: Project;
    try {
      project = new Project(root);
    } catch (e) {
      if (e instanceof NoLatDir) {
        ctx.err(`${e.message}\n`);
        return EXIT_ERROR;
      }
      throw e;
    }
    const plan = planMigration(project, { setup: !flags.has('no-setup'), since: !flags.has('no-since'), keepLat: flags.has('keep-lat'), infer: flags.has('infer') });
    const write = !flags.has('dry-run');
    const escaping = outsideRoot(root, plan.changes.map((c) => c.path));
    if (escaping.length) {
      ctx.err(`tg migrate refuses to write through symlinks that lead outside ${root}:\n${escaping.map((p) => `  ${p}`).join('\n')}\n`);
      return EXIT_ERROR;
    }
    if (write && !flags.has('force')) {
      const dirty = dirtyPaths(root, plan.changes.map((c) => c.path));
      if (dirty === null) {
        ctx.err('Could not check the files for uncommitted changes (git status failed). Commit or stash your work, or pass --force.\n');
        return EXIT_ERROR;
      }
      if (dirty.length) {
        ctx.err(`tg migrate would change files with uncommitted changes:\n${dirty.map((p) => `  ${p}`).join('\n')}\nCommit or stash them first (so the migration is one reviewable diff), or pass --force.\n`);
        return EXIT_ERROR;
      }
    }
    if (ctx.json) {
      ctx.out(`${JSON.stringify({ root, write, files: plan.changes.map((c) => ({ path: c.path, created: c.before === null })), typed: plan.typed, edges: plan.edges, upgraded: plan.upgraded, unresolved: plan.unresolved, notes: plan.notes }, null, 2)}\n`);
    } else if (!plan.changes.length) {
      ctx.out(`Nothing to migrate.${plan.unresolved.length ? ` ${plan.unresolved.length} link${plan.unresolved.length === 1 ? '' : 's'} left plain; see tg migrate --dry-run --json or the tg-migrate skill.` : ''}\n`);
    } else {
      if (!write) for (const c of plan.changes) ctx.out(`${unifiedDiff(c.path, c.before, c.after)}\n\n`);
      else for (const c of plan.changes) ctx.out(`  ${c.before === null ? '+ created' : '~ updated'} ${c.path}\n`);
      for (const n of plan.notes) ctx.out(`Note: ${n}\n`);
      ctx.out(`\n${summary(plan).join('\n')}\n`);
      if (plan.unresolved.length) {
        ctx.out('\nLinks left plain (first 20):\n');
        for (const u of plan.unresolved.slice(0, 20)) ctx.out(`  ${u.file}:${u.line} [[${u.target}]] — ${u.reason}${u.candidates.length ? ` (${u.candidates.join(' or ')})` : ''}\n`);
        ctx.out('Resolve them with the tg-migrate skill, or by hand with tg ontology for the edge names.\n');
      }
      ctx.out(write ? `\nWrote ${plan.changes.length} files. Next: tg check && tg ontology check\n` : `\nDry run: ${plan.changes.length} files would change. Run tg migrate without --dry-run to apply.\n`);
    }
    if (write) {
      for (const c of plan.changes) {
        const full = join(root, c.path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, c.after);
      }
    }
    return EXIT_OK;
  },
};

register(migrate);
