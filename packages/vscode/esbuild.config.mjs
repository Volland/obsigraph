import { build } from 'esbuild';

const watch = process.argv.includes('--watch');
const common = { bundle: true, sourcemap: false, logLevel: 'info', minify: !watch };

// Extension host: Node, with core and the loader bundled in so installing the extension needs nothing else.
await build({ ...common, entryPoints: ['src/extension.ts'], platform: 'node', format: 'cjs', target: 'node20', outfile: 'dist/extension.cjs', external: ['vscode'] });
// Webview: the shared Cytoscape renderer in a browser context.
await build({ ...common, entryPoints: ['src/webview/main.ts'], platform: 'browser', format: 'iife', target: 'es2022', outfile: 'dist/webview.js' });
