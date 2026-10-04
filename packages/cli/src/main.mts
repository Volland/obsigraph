import { run } from './cli.mjs';
import './commands/index.mjs';

const code = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  out: (t) => void process.stdout.write(t),
  err: (t) => void process.stderr.write(t),
  env: process.env,
});
process.exitCode = code;
