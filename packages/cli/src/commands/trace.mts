import { traceRequirements, type RequirementTrace, type TraceLink } from '@obsigraph/core';
import { EXIT_ERROR, EXIT_FINDINGS, EXIT_OK, register, type Command } from '../cli.mjs';
import { NoLatDir, Project } from '../project.mjs';

const loc = (l: TraceLink): string => `${l.file}${l.symbol ? `#${l.symbol}` : ''}:${l.line}${l.test ? ` "${l.test}"` : ''}`;

function gaps(r: RequirementTrace): string[] {
  const out: string[] = [];
  if (!r.implemented) out.push('unimplemented');
  if (!r.verified) out.push('unverified');
  if (!r.documented) out.push('undocumented');
  return out;
}

// @lat: [[cli#Requirement trace]]
// @tg: implements:: [[openspec:tg-trace#Trace command]]
export const trace: Command = {
  name: 'trace',
  summary: 'Show which code implements, which tests verify and which lat.md files explain each OpenSpec requirement',
  usage: 'trace [capability...] [--gaps] [--strict]',
  flags: { gaps: 'bool', strict: 'bool' },
  run(ctx, args, flags) {
    let project: Project;
    try {
      project = new Project(ctx.root);
    } catch (e) {
      if (e instanceof NoLatDir) {
        ctx.err(`${e.message}\n`);
        return EXIT_ERROR;
      }
      throw e;
    }
    const specs = project.specIndex();
    if (!specs) {
      ctx.err(`no openspec/ folder in ${ctx.root}\n`);
      return EXIT_ERROR;
    }
    const unknown = args.filter((c) => !specs.hasCapability(c));
    if (unknown.length) {
      ctx.err(`unknown capabilit${unknown.length === 1 ? 'y' : 'ies'}: ${unknown.join(', ')}\nknown: ${specs.capabilities().join(', ')}\n`);
      return EXIT_ERROR;
    }
    const docs = [...project.index().files].flatMap(([file, p]) => (p.frontmatter.openspec ? [{ file, openspec: p.frontmatter.openspec }] : []));
    const wanted = new Set(args.map((c) => c.toLowerCase()));
    const all = traceRequirements(specs, project.annotations().annotations, docs).filter((r) => !wanted.size || wanted.has(r.requirement.capability.toLowerCase()));
    const rows = flags.has('gaps') ? all.filter((r) => !r.implemented || !r.verified) : all;
    const failing = all.some((r) => !r.implemented || !r.verified);
    const exit = flags.has('strict') && failing ? EXIT_FINDINGS : EXIT_OK;

    if (ctx.json) {
      ctx.out(`${JSON.stringify(rows.map((r) => ({ ...r, requirement: { ...r.requirement, scenarios: undefined } })), null, 2)}\n`);
      return exit;
    }
    const lines: string[] = [];
    let cap = '';
    for (const r of rows) {
      const q = r.requirement;
      if (q.capability !== cap) {
        cap = q.capability;
        const of = all.filter((x) => x.requirement.capability === cap);
        lines.push('', `${cap}  ${of.length} req · ${of.filter((x) => x.implemented).length} implemented · ${of.filter((x) => x.verified).length} verified · ${of.filter((x) => x.documented).length} documented`);
      }
      const g = gaps(r);
      const status = [q.status === 'pending' ? `pending in ${q.change}` : '', q.removedBy.length ? `removed by ${q.removedBy.join(', ')}` : ''].filter(Boolean).join(', ');
      lines.push(`  ${r.implemented && r.verified ? '✓' : '✗'} ${q.name}${status ? ` (${status})` : ''}${g.length ? `  — ${g.join(', ')}` : ''}`);
      for (const l of r.implementedBy) lines.push(`      implements  ${loc(l)}`);
      for (const l of r.verifiedBy) lines.push(`      verifies    ${loc(l)}`);
      for (const s of r.scenarios) {
        if (!s.verifiedBy.length) lines.push(`      ✗ scenario  ${s.scenario.name}`);
        else for (const l of s.verifiedBy) lines.push(`      ✓ scenario  ${s.scenario.name}  ${loc(l)}`);
      }
      for (const f of r.documentedIn) lines.push(`      doc         ${f}`);
    }
    const n = all.length;
    lines.push('', `${n} requirement${n === 1 ? '' : 's'}: ${all.filter((x) => x.implemented).length} implemented, ${all.filter((x) => x.verified).length} verified, ${all.filter((x) => x.documented).length} documented`);
    ctx.out(`${lines.join('\n').replace(/^\n/, '')}\n`);
    return exit;
  },
};

register(trace);
