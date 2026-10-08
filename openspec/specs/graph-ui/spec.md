# graph-ui Specification

## Purpose
Provides the host-independent graph renderer and neighborhood view-state shared by the Obsidian plugin and the VS Code extension, so styling and expansion behavior are defined once.

## Requirements

### Requirement: Host-independent rendering
The renderer SHALL draw the same graph elements with the same node shapes, colors, edge labels, signs and stubs in any host when given the same styler and theme inputs, and SHALL take theme colors as an input supplied by the host rather than reading host-specific variables.

#### Scenario: Theme supplied by host
- **WHEN** a host passes its own color map
- **THEN** nodes and edges use those colors and no Obsidian or VS Code global is read

#### Scenario: Negative edge
- **WHEN** an edge has a negative sign
- **THEN** it has a tee arrow and a minus-prefixed label in every host, and is dashed unless a style source sets its line

### Requirement: Neighborhood view-state
The package SHALL compute the neighborhood of a node and merge element sets independent of any host UI, and each host SHALL keep the nodes the user expanded across refreshes caused by file changes.

#### Scenario: Expanded nodes kept
- **WHEN** the graph refreshes after a file change
- **THEN** previously expanded nodes remain expanded

### Requirement: No host imports
The package SHALL NOT import `obsidian` or `vscode`.

#### Scenario: Import check
- **WHEN** the package's sources are scanned for imports
- **THEN** no host module is imported

### Requirement: Restyle in place
When a refresh yields the same set of element ids, the renderer SHALL update styles and data in place without re-running layout or moving nodes.

#### Scenario: Same elements
- **WHEN** a refresh changes a node's color but no element is added or removed
- **THEN** every node keeps its position

### Requirement: No dangling edges
The renderer SHALL never draw an edge without both endpoints, adding a relationship's endpoint nodes from the graph when the result lacks them and dropping the edge when an endpoint does not exist.

#### Scenario: Relationship-only result
- **WHEN** a query returns only `r` for `(a)-[r:knows]->(b)`
- **THEN** the drawn graph contains `a`, `b` and the `knows` edge between them
