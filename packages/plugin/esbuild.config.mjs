import { build, context } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const outdir = process.env.OBSIGRAPH_OUT ?? 'dist';
mkdirSync(outdir, { recursive: true });
for (const f of ['manifest.json', 'styles.css']) copyFileSync(f, `${outdir}/${f}`);

const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  outfile: `${outdir}/main.js`,
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
};

if (watch) await (await context(options)).watch();
else await build(options);
