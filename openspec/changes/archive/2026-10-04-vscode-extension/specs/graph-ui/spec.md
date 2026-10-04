## Purpose

Provides the host-independent graph renderer and neighborhood view-state shared by the Obsidian plugin and the VS Code extension, so styling and expansion behavior are defined once.

## ADDED Requirements

### Requirement: Host-independent rendering
The renderer SHALL draw graph elements with the same node shapes, colors, edge labels, signs and stubs in any host and SHALL take theme colors as an input supplied by the host rather than reading host-specific variables.

#### Scenario: Theme supplied by host
- **WHEN** a host passes its own color map
- **THEN** nodes and edges use those colors and no Obsidian or VS Code global is read

#### Scenario: Negative edge
- **WHEN** an edge has a negative sign
- **THEN** it is drawn dashed with a tee arrow and a minus prefix in every host

### Requirement: Neighborhood view-state
The package SHALL compute the neighborhood of a node and keep user-expanded nodes across refreshes, independent of any host UI.

#### Scenario: Expanded nodes kept
- **WHEN** the graph refreshes after a file change
- **THEN** previously expanded nodes remain expanded

### Requirement: Plugin behavior preserved
The Obsidian plugin SHALL render exactly as before after adopting the shared package.

#### Scenario: Plugin tests unchanged
- **WHEN** the existing plugin render and graph-view tests run
- **THEN** they pass without modification

### Requirement: No host imports
The package SHALL NOT import `obsidian` or `vscode`.

#### Scenario: Import check
- **WHEN** the package's sources are scanned for imports
- **THEN** no host module is imported
