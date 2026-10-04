import { checkLattice, type CheckScope } from '@obsigraph/core';
import { EXIT_ERROR, EXIT_FINDINGS, EXIT_OK, register, type Command } from '../cli.mjs';
import { countByExt, NoLatDir, Project } from '../project.mjs';

const SCOPES: Record<string, CheckScope> = { md: 'md', 'code-refs': 'code-refs', index: 'index', sections: 'sections' };

export const check: Command = {
  name: 'check',
  summary: 'Validate links, code references, index files and section structure',
  usage: 'check [md|code-refs|index|sections]',
  run(ctx, args) {
    const started = Date.now();
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
    const scope = args[0];
    if (scope && !SCOPES[scope]) {
      ctx.err(`unknown check "${scope}"; expected md, code-refs, index or sections\n`);
      return EXIT_ERROR;
    }
    const scopes = scope ? [SCOPES[scope]!] : undefined;
    const needsCode = !scope || scope === 'code-refs';
    const annotations = needsCode ? project.annotations() : { annotations: [], diagnostics: [] };
    const findings = checkLattice(
      {
        index: project.index(),
        annotations: annotations.annotations,
        latEntries: project.latEntries(),
        latDirName: 'lat.md',
        readLatFile: (rel) => project.text(`lat.md/${rel}`),
        checkSourceLink: (f, s) => project.checkSourceLink(f, s),
      },
      scopes,
    );
    const files = countByExt([...project.mdFiles(), ...(needsCode ? project.sourceFiles() : [])]);
    const elapsed = Date.now() - started;
    const warnings = annotations.diagnostics;
    if (ctx.json) {
      ctx.out(`${JSON.stringify({ ok: findings.length === 0, findings, warnings, files, elapsedMs: elapsed }, null, 2)}\n`);
      return findings.length ? EXIT_FINDINGS : EXIT_OK;
    }
    const stats = Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([e, n]) => `${n} ${e}`).join(', ');
    const lines = [`Scanned ${stats} in ${elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`}`];
    for (const f of findings) {
      const [first, ...rest] = f.message.split('\n');
      lines.push('', `- ${f.file}${f.line ? `:${f.line}` : ''}: ${first}`, ...rest.map((l) => `  ${l}`));
    }
    if (ctx.verbose) for (const w of warnings) lines.push('', `warning ${w.path ?? ''}:${w.line}: ${w.message}`);
    if (findings.length) {
      lines.push('', `${findings.length} error${findings.length === 1 ? '' : 's'} found`);
      ctx.out(`${lines.join('\n')}\n`);
      return EXIT_FINDINGS;
    }
    lines.push('All checks passed');
    ctx.out(`${lines.join('\n')}\n`);
    return EXIT_OK;
  },
};

register(check);
