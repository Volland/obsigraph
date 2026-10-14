# vscode-extension Specification

## Purpose
Defines the VS Code extension that shows typed backlinks and the graph for a workspace's markdown and code without Obsidian, and leads users to set up the `tg` CLI.

## Requirements

### Requirement: Index the workspace in process
The extension SHALL build the typed graph from the configured roots inside VS Code, with no Obsidian, CLI or server installed, and SHALL update it when files change.

#### Scenario: Works on install
- **WHEN** the extension is installed in a workspace of markdown notes with typed edges and no other TypeGraph tooling
- **THEN** the backlinks panel shows data for an opened note

#### Scenario: Live update
- **WHEN** a note is saved with a new typed edge to the active note
- **THEN** the panel shows that edge without a reload

### Requirement: Configurable roots
The extension SHALL index the folders in `typegraph.roots`, resolved against the first workspace folder and defaulting to it (other folders of a multi-root workspace are not indexed), SHALL read markdown notes and, for annotations, source files under them, SHALL skip dot folders and every folder name listed in `typegraph.ignore` (default `["node_modules"]`), and SHALL never write into the indexed folders while indexing; only the explicit note-creation commands and the graph export commands write files, and an export writes only the file the user picks in a save dialog.

#### Scenario: Nested vault
- **WHEN** `typegraph.roots` is `["docs/vault"]`
- **THEN** only markdown under `docs/vault` is indexed

#### Scenario: Monorepo noise
- **WHEN** the default root contains many `node_modules/**/README.md` files
- **THEN** none of them appear in the graph

#### Scenario: Custom ignore list
- **WHEN** `typegraph.ignore` is `["node_modules", "dist"]`
- **THEN** no file under any `dist/` folder appears in the graph or backlinks

### Requirement: Typed backlinks for notes
For an active markdown note the panel SHALL list incoming edges grouped by edge type, showing source note, sign and edge properties, and SHALL open the source at the edge's line on click.

#### Scenario: Grouped by type
- **WHEN** two notes link to the active note with `knows::` and one with `blocks::`
- **THEN** the panel shows a `knows` group of two and a `blocks` group of one

#### Scenario: Negative edge
- **WHEN** an incoming edge is negative
- **THEN** it is shown with a minus sign

### Requirement: Backlinks for source files
For an active source file the panel SHALL list the notes that the file's `@lat` and `@tg` annotations point at, showing each link as written and opening the target note file on click; for an active note it SHALL list the source files whose annotations point at it, with the annotation line. Both directions SHALL work at whole-file granularity.

#### Scenario: Code to spec
- **WHEN** a source file contains `// @lat: [[architecture#Monorepo layout]]` and is active
- **THEN** the panel lists `architecture#Monorepo layout` and clicking it opens `lat.md/architecture.md`

#### Scenario: Spec to code
- **WHEN** a section is active that source files annotate
- **THEN** the panel lists those files

### Requirement: Empty and unsupported states
The panel SHALL show an explanatory empty state when the active file has no incoming edges or annotations, and a distinct message saying the file is outside `typegraph.roots` when it is, and SHALL NOT error.

#### Scenario: No edges
- **WHEN** the active note has no incoming edges
- **THEN** the panel says so and offers no stale data

#### Scenario: Outside the roots
- **WHEN** `typegraph.roots` is `["docs"]` and the active file is `src/main.ts`
- **THEN** the panel says the file is outside the configured roots

### Requirement: Graph webview
The extension SHALL provide a graph view that renders the active file's neighborhood by default, or the whole project when its scope is "Whole project" (see Whole project graph), with the shared renderer, expands a node's neighbors on right-click or long-press, opens a node's file on double-click, refreshes on change without losing expanded nodes, clears expanded nodes when the active file changes, styles nodes with the built-in type styles only (schema-note and settings styles are not read), and takes its text, muted and background colors from VS Code theme variables.

#### Scenario: Follows active file
- **WHEN** the user switches the active editor to another note
- **THEN** the graph shows that note's neighborhood

#### Scenario: Open from graph
- **WHEN** the user opens a note node's context action
- **THEN** that file opens in the editor

#### Scenario: Expand on right-click
- **WHEN** the user right-clicks a node that has neighbors not yet drawn
- **THEN** those neighbors and their edges are added and stay after the next refresh

#### Scenario: Expansions reset on file switch
- **WHEN** the user has expanded nodes and switches the active editor to another note
- **THEN** the graph shows only the new note's neighborhood

### Requirement: Set up TypeGraph
When the workspace has neither a `lat.md/` nor a `tg.md/` folder, or none of `CLAUDE.md` and `AGENTS.md` contains a `%% tg:begin %%` block and `.cursor/rules/tg.mdc` does not exist, the extension SHALL offer a "Set up TypeGraph" action in the TypeGraph sidebar view and the command palette that shows the files `tg init --write` will create or change, asks for confirmation, then runs `tg init --write` in a visible VS Code terminal, preferring a global `tg` and falling back to `npx @typedgraph/cli init --write`.

#### Scenario: Confirmation first
- **WHEN** the user selects the action
- **THEN** a confirmation lists the files before any command runs, and declining runs nothing

#### Scenario: Global tg preferred
- **WHEN** `tg` is on the PATH
- **THEN** the terminal runs `tg init --write`, otherwise `npx @typedgraph/cli init --write`

#### Scenario: Value first
- **WHEN** the workspace has neither `lat.md/` nor `tg.md/`
- **THEN** backlinks for markdown files still work and the setup offer is shown without blocking them

#### Scenario: tg.md counts as set up
- **WHEN** the workspace has `tg.md/` and `CLAUDE.md` holds a `%% tg:begin %%` block
- **THEN** no setup offer is shown

### Requirement: No telemetry
The extension SHALL NOT collect or transmit usage data and SHALL make no network requests other than those the user triggers by running setup.

#### Scenario: Offline operation
- **WHEN** the machine is offline
- **THEN** every panel and the graph view work unchanged

### Requirement: Dual-registry publishing
The extension SHALL be packaged as one `.vsix` and the repository SHALL provide a documented release path that publishes that same package to both the VS Code Marketplace and Open VSX.

#### Scenario: One package, two registries
- **WHEN** the release script runs with both registry tokens present
- **THEN** the same `.vsix` is published to both, and with a token missing the script stops before publishing anything

### Requirement: Refresh and reload
The extension SHALL rebuild its index on the "TypeGraph: Refresh Index" command and whenever a `typegraph.*` setting changes.

#### Scenario: Roots changed
- **WHEN** the user changes `typegraph.roots` from `["."]` to `["docs"]`
- **THEN** the index is rebuilt and notes outside `docs` disappear from the graph and backlinks

### Requirement: Whole project graph
The graph panel SHALL offer a "Whole project" scope that draws every node and edge of the index, and SHALL keep "Active file" as the scope the panel opens in. A toggle in the panel SHALL switch between them without closing the panel. The command `typegraph.openFullGraph` ("TypeGraph: Open Full Graph") SHALL open the panel, or reveal it if open, in the whole-project scope, and the Backlinks view title bar SHALL show a button for it next to Open Graph. When the index has more nodes than `typegraph.fullGraphLimit` (default 2000), the scope SHALL draw the nodes with the most edges up to the limit, with the edges among them, and SHALL show how many nodes were left out. The whole-project scope SHALL refresh when files change and SHALL ignore the active file.

#### Scenario: Open the full graph
- **WHEN** the user runs "TypeGraph: Open Full Graph" in a workspace of linked notes and annotated code
- **THEN** the panel shows every indexed node and edge, not only the active file's neighborhood

#### Scenario: Toggle scope
- **WHEN** the panel is in the whole-project scope and the user chooses "Active file"
- **THEN** the graph shows the active file's neighborhood again, and choosing "Whole project" shows the full graph

#### Scenario: Large graph is capped
- **WHEN** the index has more nodes than `typegraph.fullGraphLimit`
- **THEN** the panel draws the most connected nodes up to the limit and states how many were left out

#### Scenario: Full graph stays current
- **WHEN** the panel is in the whole-project scope and a note is saved with a new typed edge
- **THEN** the graph shows that edge without a reload
