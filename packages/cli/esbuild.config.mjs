import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

await build({
  entryPoints: ['src/main.mts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist/tg.mjs',
  define: { __TG_VERSION__: JSON.stringify(version) },
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'info',
});
