## Purpose

Defines how source code appears in the graph as derived nodes and edges, and how users control and see them.

## ADDED Requirements

### Requirement: Derived code nodes
The system SHALL represent source files as `CodeFile` nodes and symbols as `CodeSymbol` nodes in the in-memory graph, and SHALL NOT write any file into the vault.

#### Scenario: Annotated symbol
- **WHEN** a function has `// @tg: implements:: [[auth#Login]]`
- **THEN** a `CodeSymbol` node for it exists with an `implements` edge to the `Login` section node

#### Scenario: Vault untouched
- **WHEN** the code layer is built
- **THEN** no file in the vault is created or modified

### Requirement: Code mode setting
The system SHALL support `code: off`, `annotated` and `all`, creating no code nodes when off, nodes for annotated symbols and their files when annotated, and nodes for all discovered symbols when all.

#### Scenario: Off
- **WHEN** the mode is `off`
- **THEN** the graph contains no code nodes and annotations produce no edges

#### Scenario: Annotated only
- **WHEN** the mode is `annotated` and a file has one annotated and one plain function
- **THEN** only the annotated function and the file become nodes

### Requirement: Queryable code nodes
The system SHALL expose code nodes to Cypher with labels `CodeFile` and `CodeSymbol` and properties `path`, `lang`, `kind` and `lines`.

#### Scenario: Match code symbols
- **WHEN** `MATCH (c:CodeSymbol)-[r:implements]->(s) RETURN c.path, s.title` runs
- **THEN** one row per implementing symbol is returned

### Requirement: Link and node identity agree
The system SHALL key a code node by `path#name path` so that a wiki link to the same target resolves to the node and never creates a stub.

#### Scenario: Link from a note
- **WHEN** a note links `[[src/auth.ts#login]]` and that symbol is in the graph
- **THEN** the link edge ends at that `CodeSymbol` node

### Requirement: Visible on demand
The system SHALL show code nodes in the Graph view and in `graph-query` blocks when the Code toggle or header option is on, with distinct default styles, and SHALL fall back to a table above the element cap.

#### Scenario: Toggle on
- **WHEN** the user enables Code in the Graph view
- **THEN** code nodes and their edges are drawn in a distinct style

#### Scenario: Over the cap
- **WHEN** `all` mode yields more elements than the cap
- **THEN** the block shows a table and a notice with the count
