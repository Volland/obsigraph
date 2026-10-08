import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkOkf } from '@obsigraph/core';
import { EXIT_ERROR, EXIT_FINDINGS, EXIT_OK, register, type Command } from '../cli.mjs';
import { readOkfNotes } from '../okf.mjs';

// @tg: implements:: [[openspec:okf-compat#OKF conformance check]]
export const okf: Command = {
  name: 'okf',
  summary: 'Check a folder against Open Knowledge Format v0.2 conformance',
  usage: 'okf check [dir]',
  noProject: true,
  run(ctx, args) {
    const [sub, dirArg] = args;
    if (sub !== 'check') {
      ctx.err('usage: tg okf check [dir]\n');
      return EXIT_ERROR;
    }
    const dir = resolve(ctx.cwd, dirArg ?? '.');
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      ctx.err(`${dir} is not a directory\n`);
      return EXIT_ERROR;
    }
    const { notes } = readOkfNotes(dir);
    const findings = checkOkf(notes);
    const errors = findings.filter((f) => f.severity === 'error');
    const warnings = findings.filter((f) => f.severity === 'warning');
    if (ctx.json) {
      ctx.out(`${JSON.stringify({ ok: errors.length === 0, files: notes.length, errors, warnings }, null, 2)}\n`);
      return errors.length ? EXIT_FINDINGS : EXIT_OK;
    }
    const lines = [`Checked ${notes.length} markdown file${notes.length === 1 ? '' : 's'} against OKF v0.2`];
    for (const f of errors) lines.push(`- ${f.file}:${f.line}: ${f.message}`);
    const shown = ctx.verbose ? warnings : warnings.slice(0, 20);
    if (warnings.length) lines.push('', `${warnings.length} warning${warnings.length === 1 ? '' : 's'} (consumers must tolerate these):`);
    for (const f of shown) lines.push(`  ${f.file}:${f.line}: ${f.message}`);
    if (shown.length < warnings.length) lines.push(`  ... and ${warnings.length - shown.length} more (use --verbose)`);
    lines.push('', errors.length ? `${errors.length} conformance error${errors.length === 1 ? '' : 's'}` : 'Conformant with OKF v0.2');
    ctx.out(`${lines.join('\n')}\n`);
    return errors.length ? EXIT_FINDINGS : EXIT_OK;
  },
};

register(okf);
