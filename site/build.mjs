// Bundle the live demo into site/assets/demo.js. The rest of the site is static.
import { build } from 'esbuild';

await build({
  entryPoints: ['site/src/demo.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  outfile: 'site/assets/demo.js',
  logLevel: 'info',
});
