import agents from '../../templates/agents.md';
import cursor from '../../templates/cursor-rules.md';
import docsSkill from '../../templates/skills/tg-docs/SKILL.md';
import graphSkill from '../../templates/skills/tg-graph/SKILL.md';
import ontologyGuide from '../../templates/ontology/code-ontology.md';
import ontologySchema from '../../templates/ontology/code-types.md';
import { EXIT_ERROR, EXIT_OK, register, type Command } from '../cli.mjs';

export const TEMPLATES = { agents, cursor, docsSkill, graphSkill, ontologyGuide, ontologySchema };

const TARGETS: Record<string, string> = {
  'agents.md': agents,
  'claude.md': agents,
  'cursor-rules.md': cursor,
  'skill.md': docsSkill,
  'graph-skill.md': graphSkill,
  'ontology.md': ontologyGuide,
  'ontology-schema.md': ontologySchema,
};

export const gen: Command = {
  name: 'gen',
  summary: 'Print agent instructions: agents.md, claude.md, cursor-rules.md, skill.md, graph-skill.md, ontology.md, ontology-schema.md',
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
