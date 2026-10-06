# Publishing

How the plugin reaches users and how the website is built; both are automated from tags and pushes to `main`.

## Plugin releases

A pushed tag equal to the manifest version (no `v`) triggers `.github/workflows/release.yml`, which tests, builds and attaches `main.js`, `manifest.json` and `styles.css`.

Each release adds a section to the root `CHANGELOG.md` (plugin, CLI, core and sidecar) in the release commit; the VS Code extension keeps `packages/vscode/CHANGELOG.md`.

The plugin is listed as **Typed Graph** (id `typed-graph`): directory rules forbid names with `Obsidian` or variations like `Obsi-`, so the earlier name Obsigraph was rejected; the repository, website URL, packages and `OBSIGRAPH_*` variables keep the old name internally. Obsidian reads `manifest.json` and `versions.json` at the repository root, so `scripts/version-bump.mjs` keeps the root manifest, `packages/plugin/manifest.json`, `versions.json` and every package version in step, then refreshes `package-lock.json`; workspaces depend on `@obsigraph/core` as `*` so a bump never sends `npm ci` to the registry for an unpublished version. Store listing is a web submission at community.obsidian.md (Obsidian account plus linked GitHub), followed by an automated review; it passed and the plugin is listed at https://community.obsidian.md/plugins/typed-graph (install link `obsidian://show-plugin?id=typed-graph`); `obsidianmd/obsidian-releases` only mirrors the directory, so pull requests to its JSON no longer list a plugin.

## Website

`site/` is a static site (home, docs, live demo) published to GitHub Pages by `.github/workflows/pages.yml` at https://volland.github.io/obsigraph/.

The demo bundles the real core engine, schema styling and the plugin's pure rendering modules (`site/src/demo.ts`, built by `npm run site:build`) over an editable sample vault, with a seeded force layout so screenshots are stable. Screenshots in `site/assets/screenshots/` are taken from the demo with headless Chrome (`?example=N&theme=light|dark`). The logo, a crystal of graph facets with a ladybug, is `site/assets/logo.svg`.

Besides home, docs and demo, the site has `example.html` (the [[publishing#Example vault]] with a download link) and a blog: `blog.html` indexes long-form articles kept as flat pages (`blog-typed-graph.html` on the plugin's features, `blog-sidecar-rag.html` on the sidecar, vectors, GraphRAG and MCP, `blog-tg-cli.html` on the tg CLI for developers `blog-tg-vs-lat-md.html`, an honest comparison with lat.md that must be rechecked against its current version before changes, `blog-why-typed-graph-for-code.html`, an essay on typed links and why intent is written by hand, and `blog-okf-ready.html`, a guide to making a vault conformant with [[okf|Open Knowledge Format]] whose report and query numbers come from real runs over the demo vault and Google's GA4 sample bundle), because the Pages workflow publishes `site/*.html`. The home page has a developers section for `tg`, and `docs.html` a CLI reference. Both `index.html` and `docs.html` have a VS Code install section (`#install-vscode`) for the [[vscode]] extension, which links to its Open VSX page, because the extension is not on the VS Code Marketplace yet; plain VS Code users install the `.vsix` downloaded from there. Numbers and sample responses in the RAG article come from a real sidecar run over the example vault with local `nomic-embed-text`.

German legal pages (`impressum.html`, `datenschutz.html`, `agb.html`, in German, `noindex`) are linked from every footer. The privacy policy relies on the site loading nothing from third parties, setting no cookies and storing only the theme choice in `localStorage`; adding analytics, fonts or embeds from another origin requires updating it.

## Example vault

`example/` is a demo vault (a small research lab) that uses every plugin feature and carries the user manual: concepts, a Cypher course, a query gallery, sidecar usage and a diagnostics playground.

Every `graph-query` block, embed, schema warning and stub in it is checked by `packages/plugin/test/example-vault.test.ts` (specs in [[tests/example-vault]]), so the manual fails the build when it drifts from the engine. Examples that need the sidecar are written in plain fences. `npm run example:install` (`scripts/install-example.mjs`) builds the plugin into `example/.obsidian/plugins/typed-graph/`, which is gitignored; only `community-plugins.json` is committed. Each release also attaches `typed-graph-demo-vault.zip`: the vault with the freshly built plugin preinstalled, linked from the website and README as `releases/latest/download/typed-graph-demo-vault.zip`.
