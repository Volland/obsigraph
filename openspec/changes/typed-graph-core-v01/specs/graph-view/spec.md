## Purpose

Defines the full-pane Graph view where users explore the vault graph with labeled, signed edges and typed nodes, sharing the renderer used by inline query blocks.

## ADDED Requirements

### Requirement: Graph view leaf
The system SHALL provide a command that opens a Graph view in a workspace leaf, with a query bar that runs a Cypher query and shows its graph result.

#### Scenario: Open and query
- **WHEN** the user runs the open command and submits a query
- **THEN** the leaf shows the resulting graph

#### Scenario: Default content
- **WHEN** the view opens with no query entered
- **THEN** it shows the neighborhood of the active note

### Requirement: Edge presentation
The system SHALL draw edges as directed arrows labeled with the edge type, SHALL visually distinguish negative edges from positive ones, and SHALL label nodes with note titles.

#### Scenario: Signed edges
- **WHEN** the graph contains a `knows` edge and a `-distrusts` edge
- **THEN** both show their type label and the negative edge is styled differently from the positive one

### Requirement: Node type styling
The system SHALL style nodes by their type labels using per-type defaults from plugin settings, and SHALL render stub nodes distinctly.

#### Scenario: Typed and stub nodes
- **WHEN** the graph shows a `Person` node and a stub node
- **THEN** the `Person` node uses the configured Person style and the stub is visibly different

### Requirement: Click to expand
The system SHALL expand a node's direct neighbors in the Graph view when the user activates its expand action, and SHALL open the node's note on a modifier-click or double-click.

#### Scenario: Expand neighbors
- **WHEN** the user expands a node
- **THEN** its neighbors and connecting edges are added to the view without discarding existing elements

### Requirement: Shared renderer
The system SHALL use the same renderer and styling for the Graph view and for inline graph results, so an element looks the same in both.

#### Scenario: Consistent styling
- **WHEN** the same `Person` node appears in an inline block and in the Graph view
- **THEN** it has the same color, shape and label style in both

### Requirement: Selection details
The system SHALL show the type, ID, sign and properties of a selected edge, and the labels and properties of a selected node.

#### Scenario: Select an edge
- **WHEN** the user selects an edge with `{since: 2020}`
- **THEN** the view shows its type, sign, ID and `since` = 2020
