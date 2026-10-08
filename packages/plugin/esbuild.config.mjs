import { build, context } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const outdir = process.env.OBSIGRAPH_OUT ?? 'dist';
mkdirSync(outdir, { recursive: true });
for (const f of ['manifest.json', 'styles.css']) copyFileSync(f, `${outdir}/${f}`);

// Cytoscape inlines lodash, whose global lookup falls back to
// `Function('return this')()`. Obsidian always has `self`, so the fallback
// never runs; replacing it keeps dynamic code out of main.js for review.
const noFunctionConstructor = {
  name: 'no-function-constructor',
  setup(b) {
    b.onLoad({ filter: /cytoscape[\\/]dist[\\/].*\.m?js$/ }, async (args) => {
      const src = await readFile(args.path, 'utf8');
      return { contents: src.replaceAll("Function('return this')()", 'globalThis'), loader: 'js' };
    });
  },
};

const options = {
  plugins: [noFunctionConstructor],
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
