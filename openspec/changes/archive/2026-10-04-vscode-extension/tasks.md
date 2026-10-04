## 1. Shared Node loader

- [x] 1.1 Create `packages/node-vault` with `listMarkdown` (ignore-folder option), `readNote`, `isNotePath`, `toVaultPath` moved from the sidecar, plus package.json and tsconfig, and add it to root workspaces and typecheck
- [x] 1.2 Make `packages/sidecar/src/vault.mts` re-export from `node-vault` and confirm existing sidecar tests pass unchanged
- [x] 1.3 Add loader tests (dot folders, ignore list, frontmatter ok and broken, no host imports) and matching `lat.md/tests` spec with `@lat` refs

## 2. Shared renderer

- [x] 2.1 Create `packages/graph-ui` and move `render/*` and `view/view-state.ts` from the plugin, introducing a `Theme` input in place of Obsidian CSS-variable reads
- [x] 2.2 Point the plugin at `graph-ui` with an Obsidian theme adapter and confirm plugin render and graph-view tests pass unchanged
- [x] 2.3 Add a no-host-imports test and theme-supplied-by-host test for `graph-ui`

## 3. Extension skeleton and backlinks

- [x] 3.1 Create `packages/vscode` with manifest, esbuild bundle of core and node-vault, activation, and `typegraph.roots` setting
- [x] 3.2 Implement the workspace indexer (lazy, batched, VS Code file watcher, ignore dot folders and `node_modules`) feeding a core `Graph`
- [x] 3.3 Implement pure `backlinksFor` for notes (grouped by type, sign, properties) with unit tests
- [x] 3.4 Extend `backlinksFor` for source files and sections via the code layer and `@lat` annotations, with unit tests
- [x] 3.5 Add the backlinks tree view with click-to-open at the edge line and the empty and outside-roots states

## 4. Setup funnel

- [x] 4.1 Add "Set up TypeGraph" detection, confirmation listing files, `tg` PATH detection and `npx @typedgraph/cli init` fallback in a visible terminal
- [x] 4.2 Test that the shipped file list matches the CLI templates and that declining runs nothing

## 5. Graph webview

- [x] 5.1 Add the graph webview running `graph-ui` with `--vscode-*` theme colors, following the active editor, click-to-expand, open-from-graph
- [x] 5.2 Test message passing between host and webview for refresh keeping expanded nodes

## 6. Publishing

- [x] 6.1 Add `.vscodeignore`, icon placeholder, README, license and changelog; `vsce package` produces one `.vsix`
- [x] 6.2 Add `scripts/release-vscode.mjs` that checks `VSCE_PAT` and `OVSX_PAT` first and publishes the same `.vsix` to both registries, with a dry-run mode and a test for the missing-token refusal

## 7. Docs and verification

- [x] 7.1 Update `lat.md/` (architecture monorepo layout, visualization surfaces, new extension section and test specs) and run `lat check`
- [x] 7.2 Run `npm run verify` and fix failures, then archive the change with `openspec archive`
