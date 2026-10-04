## Purpose

Defines the VS Code extension that shows typed backlinks and the graph for a workspace's markdown and code without Obsidian, and leads users to set up the `tg` CLI.

## ADDED Requirements

### Requirement: Index the workspace in process
The extension SHALL build the typed graph from the configured roots inside VS Code, with no Obsidian, CLI or server installed, and SHALL update it when files change.

#### Scenario: Works on install
- **WHEN** the extension is installed in a workspace of markdown notes with typed edges and no other TypeGraph tooling
- **THEN** the backlinks panel shows data for an opened note

#### Scenario: Live update
- **WHEN** a note is saved with a new typed edge to the active note
- **THEN** the panel shows that edge without a reload

### Requirement: Configurable roots
The extension SHALL index the folders in `typegraph.roots`, defaulting to the workspace root, SHALL skip dot folders and `node_modules`, and SHALL never write into the indexed folders.

#### Scenario: Nested vault
- **WHEN** `typegraph.roots` is `["docs/vault"]`
- **THEN** only markdown under `docs/vault` is indexed

#### Scenario: Monorepo noise
- **WHEN** the default root contains many `node_modules/**/README.md` files
- **THEN** none of them appear in the graph

### Requirement: Typed backlinks for notes
For an active markdown note the panel SHALL list incoming edges grouped by edge type, showing source note, sign and edge properties, and SHALL open the source at the edge's line on click.

#### Scenario: Grouped by type
- **WHEN** two notes link to the active note with `knows::` and one with `blocks::`
- **THEN** the panel shows a `knows` group of two and a `blocks` group of one

#### Scenario: Negative edge
- **WHEN** an incoming edge is negative
- **THEN** it is shown with a minus sign

### Requirement: Backlinks for source files
For an active source file the panel SHALL list the `lat.md` sections that reference the file through `@lat` annotations or links, and for an active `lat.md` section SHALL list the source files that reference it, working at whole-file granularity.

#### Scenario: Code to spec
- **WHEN** a source file contains `// @lat: [[architecture#Monorepo layout]]` and is active
- **THEN** the panel lists the section `architecture#Monorepo layout` and opens it on click

#### Scenario: Spec to code
- **WHEN** a section is active that source files annotate
- **THEN** the panel lists those files

### Requirement: Empty and unsupported states
The panel SHALL show an explanatory empty state when the active file has no edges or is outside the roots, and SHALL NOT error.

#### Scenario: No edges
- **WHEN** the active note has no incoming or outgoing edges
- **THEN** the panel says so and offers no stale data

### Requirement: Graph webview
The extension SHALL provide a graph view that renders the active file's neighborhood with the shared renderer, expands neighbors on click and refreshes on change without losing expanded nodes, using VS Code theme colors.

#### Scenario: Follows active file
- **WHEN** the user switches the active editor to another note
- **THEN** the graph re-centers on that note

#### Scenario: Open from graph
- **WHEN** the user opens a note node's context action
- **THEN** that file opens in the editor

### Requirement: Set up TypeGraph
When the workspace has no `lat.md/` folder or no `tg` agent setup, the extension SHALL offer a "Set up TypeGraph" action that shows the files `tg init` will create or change, asks for confirmation, then runs `tg init` in a visible VS Code terminal, preferring a global `tg` and falling back to `npx @typedgraph/cli init`.

#### Scenario: Confirmation first
- **WHEN** the user selects the action
- **THEN** a confirmation lists the files before any command runs, and declining runs nothing

#### Scenario: Global tg preferred
- **WHEN** `tg` is on the PATH
- **THEN** the terminal runs `tg init`, otherwise `npx @typedgraph/cli init`

#### Scenario: Value first
- **WHEN** the workspace has no `lat.md/`
- **THEN** backlinks for markdown files still work and the setup offer is shown without blocking them

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
