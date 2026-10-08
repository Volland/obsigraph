# code-layer Specification

## Purpose
Defines how source code appears in the graph as derived nodes and edges, and how users control and see them.

## Requirements

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
The system SHALL expose code nodes to Cypher with label `CodeFile` and properties `path`, `lang` and `lines` (the line count), and with label `CodeSymbol` and properties `path`, `symbol`, `name`, `kind`, `lang`, `lines` (`start-end`), `startLine`, `endLine` and `signature`.

#### Scenario: Match code symbols
- **WHEN** `MATCH (c:CodeSymbol)-[r:implements]->(s) RETURN c.path, s.title` runs
- **THEN** one row per implementing symbol is returned

#### Scenario: Symbol position
- **WHEN** `function login()` spans lines 10 to 20 of `src/auth.ts` and `MATCH (c:CodeSymbol {name: "login"}) RETURN c.kind, c.startLine, c.endLine` runs
- **THEN** it returns `function`, 10 and 20

### Requirement: Link and node identity agree
The system SHALL key a code node by `path#name path` so that a wiki link to the same target resolves to the node and never creates a stub.

#### Scenario: Link from a note
- **WHEN** a note links `[[src/auth.ts#login]]` and that symbol is in the graph
- **THEN** the link edge ends at that `CodeSymbol` node

### Requirement: Visible on demand
The system SHALL let the user pick the code mode (`off`, `annotated` or `all`) from a selector in the Graph view that updates the plugin-wide setting, SHALL show code nodes in `graph-query` blocks unless the block header sets `code: hide`, SHALL draw `CodeFile` and `CodeSymbol` nodes with distinct built-in styles below any configured style, and SHALL fall back to a table above the element cap.

#### Scenario: Toggle on
- **WHEN** the user switches the Graph view's code selector from `off` to `annotated`
- **THEN** code nodes and their edges are drawn in a distinct style, and the plugin setting is `annotated`

#### Scenario: Over the cap
- **WHEN** `all` mode yields more elements than the cap
- **THEN** the block shows a table and a notice with the count

#### Scenario: Hidden by header
- **WHEN** a block header has `code: hide`
- **THEN** no code node and no edge touching one is drawn in that block

### Requirement: Contains edges
The system SHALL add `contains` edges from a file to its top-level symbols and from a class to its members, and SHALL include a member's class whenever the member is included.

#### Scenario: Annotated method
- **WHEN** only the method `Auth#login` is annotated and the code mode is `annotated`
- **THEN** the graph has `CodeFile` → `Auth` → `login` connected by `contains` edges
