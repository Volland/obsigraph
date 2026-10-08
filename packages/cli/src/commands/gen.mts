import agents from '../../templates/agents.md';
import cursor from '../../templates/cursor-rules.md';
import docsSkill from '../../templates/skills/tg-docs/SKILL.md';
import graphSkill from '../../templates/skills/tg-graph/SKILL.md';
import traceSkill from '../../templates/skills/tg-trace/SKILL.md';
import impactSkill from '../../templates/skills/tg-impact/SKILL.md';
import auditSkill from '../../templates/skills/tg-audit/SKILL.md';
import openspecPropose from '../../templates/openspec/propose.md';
import openspecApply from '../../templates/openspec/apply.md';
import openspecArchive from '../../templates/openspec/archive.md';
import openspecExplore from '../../templates/openspec/explore.md';
import ontologyGuide from '../../templates/ontology/code-ontology.md';
import ontologySchema from '../../templates/ontology/code-types.md';
import { EXIT_ERROR, EXIT_OK, register, type Command } from '../cli.mjs';

// @tg: implements:: [[openspec:tg-agent-integration#Bundled skills]]
export const TEMPLATES = { agents, cursor, docsSkill, graphSkill, traceSkill, impactSkill, auditSkill, ontologyGuide, ontologySchema };

/** Skills installed for Claude Code, by folder name under `.claude/skills/`. */
// @tg: implements:: [[openspec:tg-agent-integration#Bundled skills]]
export const SKILLS: Record<string, string> = { 'tg-docs': docsSkill, 'tg-graph': graphSkill, 'tg-trace': traceSkill, 'tg-impact': impactSkill, 'tg-audit': auditSkill };

/** Blocks appended to OpenSpec's skills and commands, by workflow stage. */
export const OPENSPEC_PATCHES = { propose: openspecPropose, apply: openspecApply, archive: openspecArchive, explore: openspecExplore };

// @tg: implements:: [[openspec:tg-agent-integration#Instruction generation]]
// @tg: implements:: [[openspec:tg-agent-integration#Skill text available]]
const TARGETS: Record<string, string> = {
  'agents.md': agents,
  'claude.md': agents,
  'cursor-rules.md': cursor,
  'skill.md': docsSkill,
  'graph-skill.md': graphSkill,
  'trace-skill.md': traceSkill,
  'impact-skill.md': impactSkill,
  'audit-skill.md': auditSkill,
  'openspec-propose.md': openspecPropose,
  'openspec-apply.md': openspecApply,
  'openspec-archive.md': openspecArchive,
  'openspec-explore.md': openspecExplore,
  'ontology.md': ontologyGuide,
  'ontology-schema.md': ontologySchema,
};

// @tg: implements:: [[openspec:tg-agent-integration#Instruction generation]]
export const gen: Command = {
  name: 'gen',
  summary: 'Print agent instructions, skills and OpenSpec patch blocks (tg gen <target>; an unknown target lists them all)',
  usage: 'gen <target>',
  noProject: true,
  run(ctx, args) {
    const text = TARGETS[(args[0] ?? '').toLowerCase()];
    if (text === undefined) {
      ctx.err(`unknown target "${args[0] ?? ''}"; supported: ${Object.keys(TARGETS).join(', ')}\n`);
      return EXIT_ERROR;
    }
    ctx.out(text);
    return EXIT_OK;
  },
};

register(gen);
