## ADDED Requirements

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

## MODIFIED Requirements

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
