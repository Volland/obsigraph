# Changelog

All notable changes to the Typed Graph plugin, the `tg` CLI, the core library and the sidecar. The VS Code extension keeps its own [changelog](packages/vscode/CHANGELOG.md).

## 0.6.0 — 2026-10-06

Open Knowledge Format (OKF v0.2) compatibility. See [Getting your vault OKF-ready](https://volland.github.io/obsigraph/blog-okf-ready.html).

### Added

- **Markdown link targets in edges.** `knows:: [Bob](/people/bob.md) {since: 2020}` is a typed edge, alone or mixed with wikilinks. Paths from the vault root (`/x.md`) and relative paths (`./x.md`, `../x.md`) resolve, percent escapes are decoded, and links to web pages are never edges. Works in the plugin, the sidecar and the CLI.
- **`tg export <out> --format okf`.** Writes a conformant OKF bundle. Wikilinks become markdown links from the bundle root, and typed edge lines keep their type, sign and properties, so tg reads the bundle back into the same graph. Every concept gets a string `type` (`--default-type`, default `Note`), plus a `title` and `description` when missing. Notes named `index.md` or `log.md` are renamed, embedded attachments are copied, and every folder gets an `index.md` (only the root one declares `okf_version: "0.2"`). The command prints a change report and verifies the output.
- **`tg okf check [dir]`.** Checks any folder against OKF conformance. It exits 1 only on conformance errors; broken links, wikilinks and missing descriptions are warnings. Supports `--json`.
- **Plain link edges (opt-in).** With `OBSIGRAPH_LINK_EDGES=1`, the sidecar turns every plain link in prose into an untyped `links_to` edge, which is how OKF reads links, so third-party bundles load as connected graphs. It is off by default.

### Changed

- A non-empty frontmatter `title` now becomes the node's `title`; before, the file name always overwrote it.
- A frontmatter `types` list adds node labels after those from `type`.
- The CLI bundle now loads bundled CommonJS dependencies through `createRequire`.

## 0.5.0 — 2026-10-04

- The `tg` CLI: a drop-in replacement for lat.md with typed `@tg:` code annotations, openCypher over docs and code, lexical search, agent setup, and `export` / `import`.
- The code layer: annotated source symbols as graph nodes in the plugin and the CLI.
- lat.md folders read in place inside an Obsidian vault.
