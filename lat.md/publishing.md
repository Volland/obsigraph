# Publishing

How the plugin reaches users and how the website is built; both are automated from tags and pushes to `main`.

## Plugin releases

A pushed tag equal to the manifest version (no `v`) triggers `.github/workflows/release.yml`, which tests, builds and attaches `main.js`, `manifest.json` and `styles.css`.

Obsidian reads `manifest.json` and `versions.json` at the repository root, so `scripts/version-bump.mjs` keeps the root manifest, `packages/plugin/manifest.json`, `versions.json` and every package version in step. Store listing is a web submission at community.obsidian.md (Obsidian account plus linked GitHub), followed by an automated review; `obsidianmd/obsidian-releases` only mirrors the directory, so pull requests to its JSON no longer list a plugin.

## Website

`site/` is a static site (home, docs, live demo) published to GitHub Pages by `.github/workflows/pages.yml` at https://volland.github.io/obsigraph/.

The demo bundles the real core engine, schema styling and the plugin's pure rendering modules (`site/src/demo.ts`, built by `npm run site:build`) over an editable sample vault, with a seeded force layout so screenshots are stable. Screenshots in `site/assets/screenshots/` are taken from the demo with headless Chrome (`?example=N&theme=light|dark`). The logo, a crystal of graph facets with a ladybug, is `site/assets/logo.svg`.
