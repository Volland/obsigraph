// Usage: node scripts/version-bump.mjs 0.5.0
// Sets the plugin version everywhere Obsidian and npm look for it.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Usage: node scripts/version-bump.mjs <x.y.z>');
  process.exit(1);
}
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const save = (p, v) => writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);

const manifest = json('packages/plugin/manifest.json');
manifest.version = version;
save('packages/plugin/manifest.json', manifest);
save('manifest.json', manifest);

const versions = json('versions.json');
versions[version] = manifest.minAppVersion;
save('versions.json', versions);

for (const p of ['package.json', 'packages/core/package.json', 'packages/plugin/package.json', 'packages/sidecar/package.json']) {
  const pkg = json(p);
  pkg.version = version;
  save(p, pkg);
}
// Keep package-lock.json in step, or `npm ci` looks for the old workspace versions on the registry.
execSync('npm install --package-lock-only --ignore-scripts', { stdio: 'inherit' });
console.log(`Version set to ${version}. Commit, then: git tag ${version} && git push origin ${version}`);
