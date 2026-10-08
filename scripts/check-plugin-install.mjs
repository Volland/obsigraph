// Do what Obsidian's community installer does and report anything that would make it fail.
// Usage: node scripts/check-plugin-install.mjs [owner/repo] [branch]
// Obsidian reads manifest.json from the default branch, then downloads main.js, manifest.json
// and styles.css from the GitHub release whose tag equals that manifest's version.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_REPO = 'Volland/obsigraph';
/** Release assets the installer downloads; main.js and manifest.json are required, styles.css we always ship. */
export const ASSETS = ['main.js', 'manifest.json', 'styles.css'];

/** Problems in a manifest that the directory or the installer rejects. */
export function manifestProblems(m) {
  const problems = [];
  if (!m || typeof m !== 'object') return ['manifest.json is not a JSON object'];
  for (const k of ['id', 'name', 'version', 'minAppVersion', 'description', 'author']) {
    if (typeof m[k] !== 'string' || !m[k].trim()) problems.push(`manifest.json has no ${k}`);
  }
  if (typeof m.id === 'string' && !/^[a-z0-9-]+$/.test(m.id)) problems.push(`id "${m.id}" must be lowercase letters, digits and dashes`);
  if (typeof m.id === 'string' && m.id.includes('obsidian')) problems.push(`id "${m.id}" must not contain "obsidian"`);
  if (typeof m.version === 'string' && !/^\d+\.\d+\.\d+$/.test(m.version)) problems.push(`version "${m.version}" is not x.y.z`);
  if (typeof m.minAppVersion === 'string' && !/^\d+\.\d+\.\d+$/.test(m.minAppVersion)) problems.push(`minAppVersion "${m.minAppVersion}" is not x.y.z`);
  if (typeof m.isDesktopOnly !== 'boolean') problems.push('manifest.json has no boolean isDesktopOnly');
  return problems;
}

/** URLs the installer fetches for `repo` at `branch`; `version` is read from the branch manifest. */
export function installUrls(repo, branch, version) {
  return {
    manifest: `https://raw.githubusercontent.com/${repo}/${branch}/manifest.json`,
    assets: Object.fromEntries(ASSETS.map((a) => [a, `https://github.com/${repo}/releases/download/${version}/${a}`])),
  };
}

/** Run the installer's downloads through `fetch`; returns the version found and every problem. */
export async function checkInstall({ repo = DEFAULT_REPO, branch = 'main', fetch = globalThis.fetch } = {}) {
  const problems = [];
  const { manifest: manifestUrl } = installUrls(repo, branch, '');
  const res = await fetch(manifestUrl);
  if (!res.ok) return { version: null, problems: [`manifest.json on ${branch}: HTTP ${res.status}`] };
  let manifest;
  try {
    manifest = JSON.parse(await res.text());
  } catch {
    return { version: null, problems: [`manifest.json on ${branch} is not valid JSON`] };
  }
  problems.push(...manifestProblems(manifest));
  const version = manifest.version;
  if (typeof version !== 'string') return { version: null, problems };

  for (const [asset, url] of Object.entries(installUrls(repo, branch, version).assets)) {
    const r = await fetch(url);
    if (!r.ok) {
      problems.push(`release ${version} has no ${asset} (HTTP ${r.status}); push the tag ${version} so the release workflow publishes it`);
      continue;
    }
    const body = await r.text();
    if (!body.length) problems.push(`release ${version} has an empty ${asset}`);
    if (asset === 'manifest.json') {
      try {
        const released = JSON.parse(body);
        if (released.id !== manifest.id) problems.push(`released manifest id "${released.id}" != "${manifest.id}"`);
        if (released.version !== version) problems.push(`released manifest version "${released.version}" != "${version}"`);
      } catch {
        problems.push(`release ${version} manifest.json is not valid JSON`);
      }
    }
  }
  return { version, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [repo = DEFAULT_REPO, branch = 'main'] = process.argv.slice(2);
  // Bust GitHub's CDN so a 404 cached before the release existed is not reported.
  const fresh = (url) => globalThis.fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { redirect: 'follow' });
  const { version, problems } = await checkInstall({ repo, branch, fetch: fresh });
  if (problems.length) {
    console.error(`Typed Graph ${version ?? '?'} cannot be installed from ${repo}@${branch}:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`Typed Graph ${version} installs from ${repo}@${branch}: ${ASSETS.join(', ')} download.`);
}
