## Context

`core` has no host imports and already provides `Graph` (`inEdges`, `outEdges`, `onChange`) and the code layer (`scanFile`, `scanAnnotations`, `lookupSymbol`). The file-reading half of the sidecar (`packages/sidecar/src/vault.mts`: `listMarkdown`, `readNote`, `isNotePath`) uses only Node built-ins, `core` and `yaml`. The renderer in `packages/plugin/src/render/` imports nothing from `obsidian`, but styles read Obsidian CSS variables and `view/view-state.ts` sits beside Obsidian-only `graph-view.ts`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One loader and one renderer shared by every host, with thin per-host adapters.
- Backlinks panel shippable before the graph webview.
- Extension works with nothing else installed.

**Non-Goals:**
- Query panel, symbol-level cursor tracking, a `tg mcp` dependency, telemetry.
- Replacing `VaultSync`'s watcher; it stays in the sidecar, the extension uses VS Code's watcher.

## Decisions

**Bundle core in the extension host (not shell out to `tg`).** The extension builds a `Graph` itself with esbuild-bundled core. Alternatives: spawn `tg mcp` (needs a CLI install, awkward live updates) or the sidecar (needs Docker). In-process matches "without Obsidian" and keeps edits live.

**Extract `packages/node-vault`, stateless only.** Moves `listMarkdown`, `readNote`, `isNotePath`, `toVaultPath` and adds an ignore-folder option. `sidecar/src/vault.mts` re-exports it so sidecar imports and tests stay untouched. Watching stays per host: `fs.watch` plus polling in the sidecar, `workspace.createFileSystemWatcher` in the extension. Alternatives: import from sidecar (drags its dependencies and build), or copy (third copy to drift).

**Extract `packages/graph-ui` before the webview.** Moves `render/*` and `view/view-state.ts` and replaces Obsidian CSS-variable reads with a `Theme` object passed in. The plugin supplies a theme from its CSS variables, the webview from `--vscode-*`. A test scans the package for `obsidian` and `vscode` imports, mirroring "Core has no host imports". Alternative: a separate VS Code renderer would fork the style precedence chain.

**Extension split: host builds data, webview renders.** The extension host owns the `Graph`; it posts plain element JSON to the webview, which runs `graph-ui` (Cytoscape cannot run in the host). Backlinks use a native tree view, not a webview, so they need no renderer and ship first.

**Backlinks computation lives in a pure module.** `backlinksFor(graph, path)` returns incoming edges grouped by type for notes; for source files it joins code-layer nodes with `@lat` annotation edges. Pure functions over `Graph` are unit-testable without VS Code. The tree view only formats results.

**Setup funnel runs `tg init` in a visible terminal.** The extension never writes setup files itself, so `tg` stays the single owner of what `init` does. The confirmation lists files by running `tg init --dry-run` if the installed `tg` supports it, otherwise a static list shipped with the extension and verified by a test against the CLI's templates.

**No telemetry; two registries.** `vsce package` produces one `.vsix`; `ovsx publish` and `vsce publish` take it from the same file. `scripts/release-vscode.mjs` checks both tokens (`VSCE_PAT`, `OVSX_PAT`) first and refuses to publish either if one is missing, so registries cannot diverge.

## Risks / Trade-offs

- [Extension reads the whole root on activation] → index lazily on first panel open, in async batches, and honor `typegraph.roots`.
- [Open VSX forks lack some `vscode` APIs] → use only stable APIs (tree view, webview, file watcher, terminal) and test packaging against both registries' validators.
- [Moving the renderer regresses the plugin] → plugin render and graph-view tests must pass unchanged before the webview is built.
- [`tg init --dry-run` may not exist] → fall back to the static, test-verified file list; add dry-run to the CLI only if that proves brittle.
- [`@typedgraph/cli` 0.5.0 unpublished on npm] → setup falls back to the published 0.4.4, which lacks the code layer; publishing 0.5.0 is a release prerequisite, not code in this change.

## Migration Plan

Pure addition plus two extractions with unchanged behavior; rollback is reverting the commit. Publishing is a manual step with the maintainer's tokens and is not performed by this change.

## Open Questions

- Marketplace publisher id and extension name (`typegraph` under which publisher); defaults to `typedgraph.typegraph` until the maintainer decides.
