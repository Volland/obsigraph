export type FlagKind = 'bool' | 'string';

export interface Parsed {
  flags: Map<string, string | true>;
  positionals: string[];
  errors: string[];
}

/** Parse `--name`, `--name value`, `--name=value` and `-h`/`-V`; unknown flags are errors. */
export function parseArgs(argv: string[], spec: Record<string, FlagKind>): Parsed {
  const flags = new Map<string, string | true>();
  const positionals: string[] = [];
  const errors: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!a.startsWith('-') || a === '-') {
      positionals.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    const bare = eq === -1 ? a.replace(/^-+/, '') : a.slice(0, eq).replace(/^-+/, '');
    const kind = spec[bare];
    if (!kind) {
      errors.push(`unknown option ${a}`);
      continue;
    }
    if (kind === 'bool') {
      flags.set(bare, true);
    } else if (eq !== -1) {
      flags.set(bare, a.slice(eq + 1));
    } else if (i + 1 < argv.length) {
      flags.set(bare, argv[++i]!);
    } else {
      errors.push(`option --${bare} needs a value`);
    }
  }
  return { flags, positionals, errors };
}
