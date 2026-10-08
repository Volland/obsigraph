## MODIFIED Requirements

### Requirement: Node type styling
The system SHALL style nodes by their type labels using the resolved style for each type, taken in order of precedence from schema notes, plugin settings and built-in defaults as specified by visualization-config, and SHALL render stub nodes distinctly.

#### Scenario: Typed and stub nodes
- **WHEN** the graph shows a `Person` node and a stub node
- **THEN** the `Person` node uses the configured Person style and the stub is visibly different

#### Scenario: Schema note wins over settings
- **WHEN** settings color `Person` red and `Types/Person.md` declares `visualization: {color: blue}`
- **THEN** Person nodes in the Graph view are blue

## ADDED Requirements

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
