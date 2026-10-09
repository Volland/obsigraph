import { existsSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { DEFAULT_SCHEMA_FOLDER, normalizeFolder, validateVault, type VaultFinding, type NoteInput } from '@obsigraph/core';
import { listMarkdown, readNote } from '@obsigraph/node-vault';
import { EXIT_ERROR, EXIT_FINDINGS, EXIT_OK, register, VERSION, type Command, type Ctx } from '../cli.mjs';

const USAGE = 'validate [--vault dir] [--schema-folder Types] [--only codes] [--ignore codes] [--schema-only] [--strict] [--format text|json|sarif]';

/** Short descriptions for SARIF rules, from the TGS specification's diagnostics table. */
const RULES: Record<string, string> = {
  'invalid-declaration': 'A schema key has a value of the wrong shape',
  'unknown-kind': 'A property declares an unsupported kind',
  'duplicate-declaration': 'A type, edge type or prefix is declared in more than one schema note',
  'unknown-prefix': 'A uri uses a prefix that is not declared',
  'unsupported-version': 'The schema note declares a TGS version this reader does not support',
  'unknown-key': 'A schema declares a key from a newer TGS version',
  'missing-property': 'A required property is absent, null or empty',
  'value-not-allowed': 'A property value is not one of its allowed values',
  'unexpected-list': 'A property that is not many holds a list',
  'edge-not-allowed': 'An outgoing edge type is not allowed for the note type',
  'missing-edge': 'A required edge is missing',
  'too-many-edges': 'An edge that is not many appears more than once',
  'wrong-target-type': 'The edge target has none of the allowed target types',
  'wrong-source-type': 'The edge source has none of the edge type\'s source types',
  'missing-edge-property': 'A required edge property is absent',
  'edge-value-not-allowed': 'An edge property value is not one of its allowed values',
  'edge-syntax': 'A malformed edge line, property block or duplicate edge id',
  style: 'An invalid visualization value',
  embed: 'A malformed, ambiguous or unpinned edge embed',
};

const str = (flags: Map<string, string | true>, k: string) => (typeof flags.get(k) === 'string' ? (flags.get(k) as string) : undefined);
const codes = (v: string | undefined) => (v === undefined ? null : new Set(v.split(',').map((c) => c.trim()).filter(Boolean)));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Every markdown note under the vault (dot folders skipped), read-only, with parsed frontmatter. */
// @tg: implements:: [[openspec:tg-validate#Validate a vault]]
async function readVault(vault: string): Promise<NoteInput[]> {
  const files = await listMarkdown(vault);
  return Promise.all(files.map(async (f) => (await readNote(vault, f.path)).note));
}

function text(findings: VaultFinding[], notes: number): string {
  const lines = findings.map((f) => `${f.path ?? '(settings)'}${f.line === null ? '' : `:${f.line}`}: ${f.severity} ${f.code}: ${f.message}`);
  const errors = findings.filter((f) => f.severity === 'error').length;
  const summary = findings.length === 0 ? `No findings in ${plural(notes, 'note')}.` : `${plural(errors, 'error')} and ${plural(findings.length - errors, 'warning')} in ${plural(notes, 'note')}.`;
  return `${[...lines, ...(lines.length ? [''] : []), summary].join('\n')}\n`;
}

/** SARIF 2.1.0 for GitHub code scanning; locations are relative to the working directory. */
// @tg: implements:: [[openspec:tg-validate#Output formats]]
function sarif(findings: VaultFinding[], vault: string, cwd: string): string {
  const used = [...new Set(findings.map((f) => f.code))].sort();
  const uri = (p: string) => relative(cwd, join(vault, p)).split(sep).join('/');
  const log = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'tg',
            version: VERSION,
            informationUri: 'https://typedgraph.org',
            rules: used.map((id) => ({ id, shortDescription: { text: RULES[id] ?? id } })),
          },
        },
        results: findings.map((f) => ({
          ruleId: f.code,
          level: f.severity,
          message: { text: f.message },
          locations: f.path === null ? [] : [{ physicalLocation: { artifactLocation: { uri: uri(f.path) }, region: { startLine: f.line ?? 1 } } }],
        })),
      },
    ],
  };
  return `${JSON.stringify(log, null, 2)}\n`;
}

// @lat: [[cli#Vault validation]]
// @tg: implements:: [[openspec:tg-validate#Exit codes and strictness]]
// @tg: implements:: [[openspec:tg-validate#Selecting findings]]
// @tg: implements:: [[openspec:tg-validate#Output formats]]
async function runValidate(ctx: Ctx, flags: Map<string, string | true>): Promise<number> {
  const started = Date.now();
  const format = str(flags, 'format') ?? (ctx.json ? 'json' : 'text');
  if (format !== 'text' && format !== 'json' && format !== 'sarif') {
    ctx.err(`unknown format "${format}"; expected text, json or sarif\n`);
    return EXIT_ERROR;
  }
  const vault = resolve(ctx.cwd, str(flags, 'vault') ?? '.');
  if (!existsSync(vault) || !statSync(vault).isDirectory()) {
    ctx.err(`${vault} is not a directory\n`);
    return EXIT_ERROR;
  }
  const notes = await readVault(vault);
  const only = codes(str(flags, 'only'));
  const ignore = codes(str(flags, 'ignore')) ?? new Set<string>();
  const findings = validateVault(notes, {
    schemaFolder: normalizeFolder(str(flags, 'schema-folder') ?? DEFAULT_SCHEMA_FOLDER),
    schemaOnly: flags.has('schema-only'),
  }).filter((f) => (!only || only.has(f.code)) && !ignore.has(f.code));
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.length - errors;
  const failed = errors > 0 || (flags.has('strict') && warnings > 0);

  if (format === 'json') ctx.out(`${JSON.stringify({ ok: !failed, notes: notes.length, counts: { error: errors, warning: warnings }, findings }, null, 2)}\n`);
  else if (format === 'sarif') ctx.out(sarif(findings, vault, ctx.cwd));
  else ctx.out(text(findings, notes.length));
  if (ctx.verbose) ctx.err(`validated ${plural(notes.length, 'note')} in ${Date.now() - started} ms\n`);
  return failed ? EXIT_FINDINGS : EXIT_OK;
}

export const validate: Command = {
  name: 'validate',
  summary: 'Validate a vault against its schema notes: edge syntax, schema, style and embed findings',
  usage: USAGE,
  flags: { vault: 'string', 'schema-folder': 'string', only: 'string', ignore: 'string', 'schema-only': 'bool', strict: 'bool', format: 'string' },
  noProject: true,
  run(ctx, args, flags) {
    if (args.length) {
      ctx.err(`usage: tg ${USAGE}\n`);
      return EXIT_ERROR;
    }
    return runValidate(ctx, flags);
  },
};

register(validate);
