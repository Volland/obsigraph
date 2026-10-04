import { readFileSync } from 'node:fs';
import { run } from './cli.mjs';
import './commands/index.mjs';

const code = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  out: (t) => void process.stdout.write(t),
  err: (t) => void process.stderr.write(t),
  env: process.env,
  stdin: () => {
    try {
      return readFileSync(0, 'utf8');
    } catch {
      return '';
    }
  },
});
process.exitCode = code;
