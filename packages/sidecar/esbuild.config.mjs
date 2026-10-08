import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

await build({
  entryPoints: ['src/main.mts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist/server.mjs',
  define: { __SIDECAR_VERSION__: JSON.stringify(version) },
  // Native modules stay outside the bundle.
  external: ['@ladybugdb/core'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'info',
});
