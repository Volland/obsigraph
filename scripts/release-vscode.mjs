// Publish the one packaged .vsix to both the VS Code Marketplace and Open VSX.
// Usage: VSCE_PAT=... OVSX_PAT=... node scripts/release-vscode.mjs [--dry-run] [path/to/typegraph.vsix]
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_VSIX = 'packages/vscode/typegraph.vsix';

/** Commands that publish `vsix` to both registries; throws before anything runs if a token is missing. */
// @tg: implements:: [[openspec:vscode-extension#Dual-registry publishing]]
export function plan(env, vsix) {
  const missing = ['VSCE_PAT', 'OVSX_PAT'].filter((k) => !env[k]);
  if (missing.length) throw new Error(`missing ${missing.join(' and ')}; nothing was published to either registry`);
  return [
    { registry: 'VS Code Marketplace', cmd: 'npx', args: ['vsce', 'publish', '--packagePath', vsix, '--pat', env.VSCE_PAT] },
    { registry: 'Open VSX', cmd: 'npx', args: ['ovsx', 'publish', vsix, '--pat', env.OVSX_PAT] },
  ];
}

/** Publish to both registries with `run`; with `dryRun` only report what would run. */
// @tg: implements:: [[openspec:vscode-extension#Dual-registry publishing]]
export function release({ env, vsix = DEFAULT_VSIX, dryRun = false, run, log = () => {} }) {
  const steps = plan(env, vsix);
  for (const s of steps) {
    log(`${dryRun ? 'would publish' : 'publishing'} ${vsix} to ${s.registry}`);
    if (!dryRun) run(s.cmd, s.args);
  }
  return steps.map((s) => s.registry);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const vsix = args.find((a) => !a.startsWith('--')) ?? DEFAULT_VSIX;
  try {
    if (!existsSync(vsix)) throw new Error(`${vsix} not found; run npm run package -w typegraph-vscode first`);
    release({
      env: process.env,
      vsix,
      dryRun: args.includes('--dry-run'),
      log: (m) => console.log(m),
      run: (cmd, a) => {
        const r = spawnSync(cmd, a, { stdio: 'inherit' });
        if (r.status !== 0) throw new Error(`${cmd} ${a[0]} ${a[1]} failed with exit code ${r.status}`);
      },
    });
  } catch (e) {
    console.error(`release-vscode: ${e.message}`);
    process.exit(1);
  }
}
