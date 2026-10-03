# ladybug-backend Specification

## Purpose
Defines the optional desktop-only LadybugDB query backend: how a query selects it, what it may run, how its results match the shared result contract, and how it fails when unavailable.

## Requirements

### Requirement: Same interface and result contract
The system SHALL return Ladybug results through the same query interface as the in-plugin engine, as columns each with a name and kind (node, relationship or scalar) plus rows of values.

#### Scenario: Mixed columns
- **WHEN** a query returning `a, r.since` runs on the Ladybug backend
- **THEN** column `a` is reported as nodes and `r.since` as scalars, as it would be on the in-plugin engine

#### Scenario: Renderer unchanged
- **WHEN** a Ladybug result contains nodes and relationships
- **THEN** the block renders a graph exactly as it would for the other backend

### Requirement: Full Cypher for reads
The system SHALL pass read queries to LadybugDB so that any read-only Cypher the installed LadybugDB supports can be used, including clauses the in-plugin engine reports as unsupported.

#### Scenario: Clause unsupported in-plugin
- **WHEN** a query uses a read clause the in-plugin engine does not support and the Ladybug backend is selected
- **THEN** the query runs and returns a result

### Requirement: Read-only enforcement
The system SHALL reject `CREATE`, `SET`, `DELETE`, `MERGE` and `REMOVE`, and any other statement that modifies data or schema, before it reaches the database, SHALL report the rejection as a read-only error, and SHALL leave the mirror and the vault unchanged.

#### Scenario: Write attempt
- **WHEN** the query `MATCH (n) SET n.title = 'x'` runs on the Ladybug backend
- **THEN** an error states that queries are read-only and nothing changes

#### Scenario: Write hidden in later clause
- **WHEN** a query contains `CREATE` after a `WITH` clause or in a second statement
- **THEN** it is rejected as read-only

#### Scenario: Keyword inside a string
- **WHEN** a query contains the word `DELETE` only inside a string literal or comment
- **THEN** it is not rejected for that reason

#### Scenario: Schema statement
- **WHEN** the query is a table definition or drop statement
- **THEN** it is rejected as not a read query

### Requirement: Sign, id and stub properties
The system SHALL expose each relationship's sign as `r.sign` and id as `r.id`, and each node's stub flag as `n.stub`, with the same values and types as the in-plugin engine.

#### Scenario: Filter negative edges
- **WHEN** the query `MATCH (a)-[r]->(b) WHERE r.sign = -1 RETURN a, b` runs on Ladybug
- **THEN** only negative edges are returned

### Requirement: Backend selection
The system SHALL choose the backend per query from a `backend` header option with values `builtin` and `ladybug`, falling back to a plugin default setting when absent, and SHALL report an unknown value as a header error.

#### Scenario: Header overrides default
- **WHEN** the plugin default is `builtin` and the block header says `backend: ladybug`
- **THEN** the query runs on Ladybug

#### Scenario: Default used
- **WHEN** the block has no `backend` option and the default is `ladybug`
- **THEN** the query runs on Ladybug

#### Scenario: Unknown value
- **WHEN** the header says `backend: neo4j`
- **THEN** the block shows a header error naming the allowed values

### Requirement: Clear error when unavailable
The system SHALL show an in-block error that names the cause when the Ladybug backend is selected but cannot run (sidecar not configured or unreachable, LadybugDB unavailable or disabled on the sidecar, mirror rebuilding or failed), and SHALL NOT silently fall back to the other backend.

#### Scenario: Sidecar not configured
- **WHEN** a block selects Ladybug and no sidecar URL is set
- **THEN** the block says Ladybug runs in the sidecar and how to configure it, and the rest of the note renders normally

#### Scenario: Ladybug unavailable on the sidecar
- **WHEN** a block selects Ladybug and the sidecar reports LadybugDB unavailable
- **THEN** the block shows the sidecar's reason and how to enable it

#### Scenario: Mirror rebuilding
- **WHEN** a block selects Ladybug while the mirror is rebuilding
- **THEN** the block shows that the mirror is not ready and re-runs when it becomes ready

### Requirement: Freshness before reads
The system SHALL ensure a Ladybug query sees all note changes synced before it ran, or indicate the mirror is behind.

#### Scenario: Edit then query
- **WHEN** a note edge is added and a Ladybug block re-runs after the sync completes
- **THEN** the result includes the new edge

#### Scenario: Sync pending
- **WHEN** a sync is in progress when a block runs
- **THEN** the block waits for the sync or shows that results may be stale

### Requirement: Errors reported with position
The system SHALL report Ladybug syntax and runtime errors in the block with the database message and, where available, line and column.

#### Scenario: Syntax error
- **WHEN** a Ladybug query is `MATCH (a RETURN a`
- **THEN** the block shows a syntax error message
