// Build the plugin straight into the demo vault: example/.obsidian/plugins/typed-graph/
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const out = resolve('example/.obsidian/plugins/typed-graph');
const r = spawnSync('npm', ['run', 'build', '-w', '@obsigraph/plugin'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, OBSIGRAPH_OUT: out },
});
if (r.status === 0) console.log(`\nInstalled into ${out}\nOpen the example folder as a vault in Obsidian, then open "Start Here".`);
process.exit(r.status ?? 1);
