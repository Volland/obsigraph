# Publishing

How the plugin reaches users and how the website is built; both are automated from tags and pushes to `main`.

## Plugin releases

A pushed tag equal to the manifest version (no `v`) triggers `.github/workflows/release.yml`, which tests, builds and attaches `main.js`, `manifest.json` and `styles.css`.

The plugin is listed as **Typed Graph** (id `typed-graph`): directory rules forbid names with `Obsidian` or variations like `Obsi-`, so the earlier name Obsigraph was rejected; the repository, website URL, packages and `OBSIGRAPH_*` variables keep the old name internally. Obsidian reads `manifest.json` and `versions.json` at the repository root, so `scripts/version-bump.mjs` keeps the root manifest, `packages/plugin/manifest.json`, `versions.json` and every package version in step. Store listing is a web submission at community.obsidian.md (Obsidian account plus linked GitHub), followed by an automated review; `obsidianmd/obsidian-releases` only mirrors the directory, so pull requests to its JSON no longer list a plugin.

## Website

`site/` is a static site (home, docs, live demo) published to GitHub Pages by `.github/workflows/pages.yml` at https://volland.github.io/obsigraph/.

The demo bundles the real core engine, schema styling and the plugin's pure rendering modules (`site/src/demo.ts`, built by `npm run site:build`) over an editable sample vault, with a seeded force layout so screenshots are stable. Screenshots in `site/assets/screenshots/` are taken from the demo with headless Chrome (`?example=N&theme=light|dark`). The logo, a crystal of graph facets with a ladybug, is `site/assets/logo.svg`.

## Example vault

`example/` is a demo vault (a small research lab) that uses every plugin feature and carries the user manual: concepts, a Cypher course, a query gallery, sidecar usage and a diagnostics playground.

Every `graph-query` block, embed, schema warning and stub in it is checked by `packages/plugin/test/example-vault.test.ts` (specs in [[tests/example-vault]]), so the manual fails the build when it drifts from the engine. Examples that need the sidecar are written in plain fences. `npm run example:install` (`scripts/install-example.mjs`) builds the plugin into `example/.obsidian/plugins/typed-graph/`, which is gitignored; only `community-plugins.json` is committed.
