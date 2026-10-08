# graph-view Specification

## Purpose
Defines the full-pane Graph view where users explore the vault graph with labeled, signed edges and typed nodes, sharing the renderer used by inline query blocks.

## Requirements

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
The system SHALL style nodes by their type labels using the resolved style for each type, taken in order of precedence from schema notes, plugin settings and built-in defaults as specified by visualization-config, and SHALL render stub nodes distinctly.

#### Scenario: Typed and stub nodes
- **WHEN** the graph shows a `Person` node and a stub node
- **THEN** the `Person` node uses the configured Person style and the stub is visibly different

#### Scenario: Schema note wins over settings
- **WHEN** settings color `Person` red and `Types/Person.md` declares `visualization: {color: blue}`
- **THEN** Person nodes in the Graph view are blue

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

### Requirement: Expanded nodes lifecycle
The Graph view SHALL keep the nodes the user expanded across refreshes caused by vault changes, and SHALL clear them when the user submits a new query or the followed note changes.

#### Scenario: Kept across an edit
- **WHEN** the user expands `Bob` and then edits an unrelated note
- **THEN** Bob's neighbors are still drawn after the refresh

#### Scenario: Cleared on note switch
- **WHEN** the user expands `Bob` and then opens another note that the view follows
- **THEN** the view shows only that note's neighborhood

### Requirement: Query input
The Graph view SHALL run the query in its input on Ctrl+Enter or Cmd+Enter, and submitting an empty query SHALL return the view to following the active note's neighborhood.

#### Scenario: Empty query
- **WHEN** the view shows a query result and the user clears the input and submits
- **THEN** the view shows the active note's neighborhood and follows note switches again
