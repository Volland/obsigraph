## Why

TypeGraph's graph model, Cypher engine and code layer already run without Obsidian (`core`, `cli`, `sidecar`), but the only visual surface is the Obsidian plugin. Developers who keep markdown and `lat.md/` next to their code, and agent users in VS Code, cannot see typed backlinks or the graph where they work, and VS Code has no tool that understands typed or signed edges or links source code to spec sections. An extension fills that gap and doubles as the entry point that leads users to `tg init`.

## What Changes

- Add a VS Code extension `packages/vscode`, published to both the VS Code Marketplace and Open VSX, that bundles `@obsigraph/core` in its extension host and indexes the workspace in-process.
- Add a typed backlinks panel for the active file: notes show incoming edges grouped by edge type with sign and properties; source files show the `lat.md` sections that reference them through `@lat` annotations, and sections show the code pointing at them. Whole-file first.
- Add a "Set up TypeGraph" empty state that offers `tg init`, preferring a global `tg` and falling back to `npx @typedgraph/cli init`, after a confirmation listing the files that will be created or changed.
- Add configurable roots (`typegraph.roots`, default the workspace root) with dot folders and `node_modules` ignored.
- Extract the stateless Node file-reading code from the sidecar into a new shared package `packages/node-vault` (file listing, note reading, path helpers; no watcher). The sidecar and the extension both depend on it.
- Extract the host-independent renderer and view-state from the plugin into a new shared package `packages/graph-ui`, taking theme variables as input, and add a graph webview to the extension that follows the active note.
- No telemetry. Publishing metadata and a release script cover both registries; the actual publish needs the maintainer's registry tokens.

Non-goals: a query panel (later), symbol-level cursor tracking (later), patching VS Code's own UI, any data collection.

## Capabilities

### New Capabilities
- `vscode-extension`: the extension's backlinks panel, graph webview, roots setting, setup funnel and publishing.
- `node-vault-loader`: the shared Node loader for listing and reading markdown into core `NoteInput` values.
- `graph-ui`: the shared host-independent graph renderer and view-state.

### Modified Capabilities

None. The sidecar and plugin keep their externally observable behavior; they only change how they obtain shared code.

## Impact

- New packages `packages/node-vault`, `packages/graph-ui`, `packages/vscode`; root `workspaces`, `typecheck` and `verify` scripts gain them.
- `packages/sidecar/src/vault.mts` becomes a re-export of `node-vault`; `packages/plugin/src/render/*` and `view/view-state.ts` move to `graph-ui`.
- New dev dependencies: `@types/vscode`, `@vscode/vsce`, `ovsx`.
- `lat.md/` gains an extension section and updates to architecture and visualization docs.
- Prerequisite outside this change: `@typedgraph/cli` 0.5.0 must be published to npm before the setup button can offer the code layer.
