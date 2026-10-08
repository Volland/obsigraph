# VS Code Extension

A VS Code extension that shows typed backlinks and the graph for a workspace's markdown and annotated code without Obsidian, and leads users to set up the `tg` CLI.

The extension is a thin adapter in [[packages/vscode/src/extension.ts#activate]]; everything it shows comes from pure modules that run without VS Code, so [[tests/vscode-extension]] covers them directly. It bundles `core`, `node-vault` and `graph-ui`, so installing it needs no CLI, server or Obsidian.

## Workspace index

The extension builds the typed graph in process from the configured roots and keeps it current per file.

[[packages/vscode/src/workspace-index.ts#WorkspaceIndex]] lists markdown and supported source files under `typegraph.roots` (default the workspace folder) with [[packages/node-vault/src/index.ts#listFiles]], skipping dot folders and `typegraph.ignore` names such as `node_modules`. Node ids are workspace-relative paths. Markdown feeds the core graph; source files feed the code layer in `annotated` mode and a per-file annotation index. The index never writes into the workspace. VS Code's file watcher drives updates in the adapter, unlike the sidecar's `fs.watch` with polling; only the stateless reading is shared. Loading is lazy: the first view or command triggers it, and a settings change reloads it. Only the first workspace folder is indexed.

## Backlinks

The Backlinks view lists, for the active file, what points at it, grouped by edge type with sign and properties; click opens the source at the line.

[[packages/vscode/src/backlinks.ts#backlinksFor]] is pure over the index. For a note it groups incoming note edges by type and adds a `referenced from code` group built from annotations, because the code layer's graph edges would lose the heading written in the comment. For a source file it lists the notes its `@lat` and `@tg` annotations point at, with the link as written. It works at whole-file granularity; tracking the cursor's symbol is a later step. Files outside the roots or without edges give an empty result and the view shows a short message.

## Graph webview

A webview renders the active file's neighborhood with the shared renderer, using VS Code theme colors.

The extension host owns the graph and posts plain element data; the webview bundle runs `graph-ui`, because Cytoscape needs a DOM. [[packages/vscode/src/graph-session.ts#GraphSession]] merges the active file's neighborhood with the neighborhoods of expanded nodes, so expansions survive refreshes and vanish when their nodes do. Expand is right-click or long-press, open is double-click, the same as the Obsidian leaf.

## Set up TypeGraph

A welcome-view action runs `tg init --write` in a visible terminal after listing the files it will touch and asking to confirm.

[[packages/vscode/src/setup.ts#runSetup]] prefers a global `tg` and falls back to `npx @typedgraph/cli init --write`. The extension never writes setup files itself, so `tg` stays the single owner of what init does; [[packages/vscode/src/setup.ts#SETUP_FILES]] is checked against the CLI's own plan by a test. The action shows while the workspace has no `lat.md/` or no tg-managed instruction block, and backlinks work either way. This is the funnel: users see value from backlinks first, then one click leads to agent integration.

## Creating notes

TypeGraph: New Typed Note creates a note from a declared type, and the child and sibling commands branch from the active note's Luhmann id.

[[packages/vscode/src/new-note.ts#planWorkspaceNote]] is pure over the index: it finds the type in the schema folder (`typegraph.schemaFolder`, default `Types/`), reads the linked template note from disk, and returns a path and content with ids and template tokens filled in by core's planner. The adapter offers a type picker with each type's id kinds, asks for a title, never overwrites an existing file, and opens the new note. The command is also in the Explorer folder menu, which picks the folder. Child and sibling commands need the active note to have a value for its type's Luhmann id property; they create a note of the same type next to it with the next free id and a link back through the template's `{{parent-link}}`.

## Privacy

The extension reads the workspace and writes only the notes a user creates with the New Typed Note commands, collects no telemetry and makes no network requests of its own.

A test scans the sources for networking imports. The only outward step is the setup command the user confirms, and `npx` may then download the CLI.

## Publishing

One packaged `.vsix` is published to both the VS Code Marketplace and Open VSX by a script that refuses to publish anywhere unless both tokens are present.

The publisher (namespace) is `pavlyshyn`, so the id is `pavlyshyn.typegraph-vscode` and the Open VSX page is `open-vsx.org/extension/pavlyshyn/typegraph-vscode`; the npm scope `@typedgraph` is separate. The extension versions independently of the root version bump; it is live on both registries (the Marketplace page is `marketplace.visualstudio.com/items?itemName=pavlyshyn.typegraph-vscode`), and a lone Open VSX publish is `npx ovsx publish packages/vscode/typegraph.vsix -p $OVSX_PAT`.

`npm run package:vscode` builds the bundles and runs `vsce package`; `npm run release:vscode` calls `scripts/release-vscode.mjs` with `VSCE_PAT` and `OVSX_PAT`, supports `--dry-run`, and publishes the same file to both registries so they cannot diverge. Publishing needs the maintainer's tokens and is not part of CI. The `@typedgraph/cli` version the setup flow downloads must be published to npm first, or setup falls back to an older release without the code layer.
