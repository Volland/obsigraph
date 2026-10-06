import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { checkLattice, checkOkf, exportLattice, exportOkf, LOSS_DESCRIPTIONS, OKF_CHANGE_DESCRIPTIONS, type ExportFile, type Finding } from '@obsigraph/core';
import { EXIT_ERROR, EXIT_FINDINGS, EXIT_OK, register, type Command, type Ctx } from '../cli.mjs';
import { readOkfNotes } from '../okf.mjs';
import { Project } from '../project.mjs';
import { walkProject } from '../walk.mjs';

const isEmptyDir = (p: string): boolean => {
  try {
    return readdirSync(p).length === 0;
  } catch {
    return true;
  }
};

const inside = (child: string, parent: string): boolean => child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);

function verify(out: string): Finding[] {
  const project = new Project(out);
  return checkLattice({
    index: project.index(),
    annotations: project.annotations().annotations,
    latEntries: project.latEntries(),
    latDirName: 'lat.md',
    readLatFile: (rel) => project.text(`lat.md/${rel}`),
    checkSourceLink: (f, s) => project.checkSourceLink(f, s),
  });
}

const USAGE = 'export <outDir> [--format lat|okf] [--vault dir] [--folder sub] [--default-type T] [--title T] [--force]';

/** Write an OKF v0.2 bundle into `out`, copy embedded attachments, then verify it with the OKF check. */
// @lat: [[okf#Export]]
function exportOkfBundle(ctx: Ctx, base: string, out: string, flags: Map<string, string | true>): number {
  const { notes, others } = readOkfNotes(base);
  if (!notes.length) {
    ctx.err(`no markdown notes found under ${base}\n`);
    return EXIT_ERROR;
  }
  const str = (k: string) => (typeof flags.get(k) === 'string' ? (flags.get(k) as string) : undefined);
  const { files, attachments, report } = exportOkf(notes, { defaultType: str('default-type'), title: str('title'), attachments: others });
  for (const f of files) {
    const full = join(out, f.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, f.text);
  }
  for (const a of attachments) {
    mkdirSync(dirname(join(out, a)), { recursive: true });
    cpSync(join(base, a), join(out, a));
  }
  const errors = checkOkf(readOkfNotes(out).notes).filter((f) => f.severity === 'error');
  if (ctx.json) {
    ctx.out(`${JSON.stringify({ out, format: 'okf', files: files.length, attachments: attachments.length, report, errors }, null, 2)}\n`);
    return errors.length ? EXIT_FINDINGS : EXIT_OK;
  }
  const lines = [`Exported ${notes.length} notes to ${relative(ctx.cwd, out) || '.'} as an OKF v0.2 bundle (${files.length} files${attachments.length ? `, ${attachments.length} attachments` : ''}).`, ''];
  lines.push(report.length ? 'Change report:' : 'Change report: nothing was added or changed.');
  for (const e of report) lines.push(`  ${String(e.count).padStart(4)}  ${OKF_CHANGE_DESCRIPTIONS[e.kind]}${e.examples.length ? ` (e.g. ${e.examples.join(', ')})` : ''}`);
  if (errors.length) {
    lines.push('', `${errors.length} conformance error${errors.length === 1 ? '' : 's'} remain:`);
    for (const f of errors.slice(0, 20)) lines.push(`  - ${f.file}:${f.line}: ${f.message}`);
    if (errors.length > 20) lines.push(`  ... and ${errors.length - 20} more`);
  } else lines.push('', 'Verified: tg okf check passes on the output.');
  ctx.out(`${lines.join('\n')}\n`);
  return errors.length ? EXIT_FINDINGS : EXIT_OK;
}

export const exportCmd: Command = {
  name: 'export',
  summary: 'Project vault notes into a lat.md folder (lossy) or an OKF bundle, with a report',
  usage: USAGE,
  flags: { vault: 'string', folder: 'string', force: 'bool', format: 'string', 'default-type': 'string', title: 'string' },
  noProject: true,
  run(ctx: Ctx, args, flags) {
    const outArg = args[0];
    if (!outArg) {
      ctx.err(`usage: tg ${USAGE}\n`);
      return EXIT_ERROR;
    }
    const format = typeof flags.get('format') === 'string' ? (flags.get('format') as string) : 'lat';
    if (format !== 'lat' && format !== 'okf') {
      ctx.err(`unknown format "${format}"; expected lat or okf\n`);
      return EXIT_ERROR;
    }
    const out = resolve(ctx.cwd, outArg);
    const vault = resolve(ctx.cwd, typeof flags.get('vault') === 'string' ? (flags.get('vault') as string) : '.');
    const base = typeof flags.get('folder') === 'string' ? join(vault, flags.get('folder') as string) : vault;
    if (!existsSync(base) || !statSync(base).isDirectory()) {
      ctx.err(`${base} is not a directory\n`);
      return EXIT_ERROR;
    }
    if (inside(out, base)) {
      ctx.err(`refusing to export into ${out}: it is inside the notes being exported (${base})\n`);
      return EXIT_ERROR;
    }
    if (!isEmptyDir(out) && !flags.has('force')) {
      ctx.err(`refusing to overwrite ${out}: it is not empty (use --force to write into it)\n`);
      return EXIT_ERROR;
    }
    if (format === 'okf') return exportOkfBundle(ctx, base, out, flags);
    const notes = walkProject(base)
      .filter((p) => p.endsWith('.md'))
      .map((p) => ({ path: p, text: readFileSync(join(base, p), 'utf8') }));
    if (!notes.length) {
      ctx.err(`no markdown notes found under ${base}\n`);
      return EXIT_ERROR;
    }
    const { files, report } = exportLattice(notes);
    for (const f of files as ExportFile[]) {
      const full = join(out, f.path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, f.text);
    }
    const findings = verify(out);
    if (ctx.json) {
      ctx.out(`${JSON.stringify({ out, files: files.length, report, findings }, null, 2)}\n`);
      return findings.length ? EXIT_FINDINGS : EXIT_OK;
    }
    const lines = [`Exported ${notes.length} notes to ${relative(ctx.cwd, join(out, 'lat.md')) || 'lat.md'} (${files.length} files).`, ''];
    lines.push(report.length ? 'Loss report (export is a lossy projection; a round trip is not guaranteed):' : 'Loss report: nothing was dropped or changed.');
    for (const e of report) lines.push(`  ${String(e.count).padStart(4)}  ${LOSS_DESCRIPTIONS[e.kind]}${e.examples.length ? ` (e.g. ${e.examples.join(', ')})` : ''}`);
    if (findings.length) {
      lines.push('', `${findings.length} finding${findings.length === 1 ? '' : 's'} remain that tg check and lat check will also report:`);
      for (const f of findings.slice(0, 20)) lines.push(`  - ${f.file}${f.line ? `:${f.line}` : ''}: ${f.message.split('\n')[0]}`);
      if (findings.length > 20) lines.push(`  ... and ${findings.length - 20} more`);
    } else lines.push('', 'Verified: tg check passes on the output.');
    ctx.out(`${lines.join('\n')}\n`);
    return findings.length ? EXIT_FINDINGS : EXIT_OK;
  },
};

export const importCmd: Command = {
  name: 'import',
  summary: 'Adopt an existing lat.md/ folder into the current vault or project, by copy or mount',
  usage: 'import <path-to-lat.md-or-project> [--mount] [--into name]',
  flags: { mount: 'bool', into: 'string' },
  noProject: true,
  run(ctx: Ctx, args, flags) {
    const srcArg = args[0];
    if (!srcArg) {
      ctx.err('usage: tg import <path-to-lat.md-or-project> [--mount] [--into name]\n');
      return EXIT_ERROR;
    }
    let src = resolve(ctx.cwd, srcArg);
    if (existsSync(join(src, 'lat.md')) && statSync(join(src, 'lat.md')).isDirectory()) src = join(src, 'lat.md');
    if (!existsSync(src) || !statSync(src).isDirectory()) {
      ctx.err(`${src} is not a lat.md directory\n`);
      return EXIT_ERROR;
    }
    const dest = join(ctx.root, typeof flags.get('into') === 'string' ? (flags.get('into') as string) : 'lat.md');
    if (inside(dest, src) || inside(src, dest)) {
      ctx.err('source and destination overlap\n');
      return EXIT_ERROR;
    }
    if (existsSync(dest) && !isEmptyDir(dest)) {
      ctx.err(`refusing to import into ${dest}: it already exists and is not empty\n`);
      return EXIT_ERROR;
    }
    mkdirSync(dirname(dest), { recursive: true });
    if (flags.has('mount')) symlinkSync(src, dest, 'dir');
    else cpSync(src, dest, { recursive: true, errorOnExist: true, force: false });
    ctx.out(`${flags.has('mount') ? 'Mounted' : 'Copied'} ${src} -> ${dest}. The source is unchanged. Run tg check to validate it here.\n`);
    return EXIT_OK;
  },
};

register(exportCmd, importCmd);
