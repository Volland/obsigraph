## Purpose

Defines the `graph-query` fenced code block that lets a note embed a Cypher query and see its result as a table or graph, updating as the vault changes.

## ADDED Requirements

### Requirement: Block structure
The system SHALL render fenced blocks tagged `graph-query` whose content is an optional header of `key: value` lines, a blank line, and then the Cypher text.

#### Scenario: Header and query
- **WHEN** a block has the header line `view: table` followed by a blank line and a `MATCH ... RETURN ...` query
- **THEN** the query runs and its result is rendered as a table

#### Scenario: No header
- **WHEN** a block contains only a Cypher query
- **THEN** it runs with default options

### Requirement: Renderer chosen by result shape
The system SHALL render results as a graph when the returned columns contain nodes or relationships, and as a table when they contain only scalars, unless the header sets `view`.

#### Scenario: Nodes and edges
- **WHEN** a query returns `a, r, b`
- **THEN** the block renders a graph with labeled, signed edges

#### Scenario: Scalars only
- **WHEN** a query returns `a.title, r.since`
- **THEN** the block renders a table

### Requirement: View override and columns
The system SHALL honor `view: table` and `view: graph` and, for tables, a `columns` header listing the columns to show and their order.

#### Scenario: Forced table
- **WHEN** a query returns nodes and the header says `view: table`
- **THEN** the result renders as a table with node titles linking to their notes

### Requirement: Live refresh
The system SHALL re-run a visible block when notes change, debounced, without flicker or loss of scroll position.

#### Scenario: Edge edited
- **WHEN** a note changes in a way that alters the query result
- **THEN** the block updates within a short debounce interval

### Requirement: Errors shown in place
The system SHALL show query and header errors inside the block with their message and position, and SHALL NOT break the rest of the note.

#### Scenario: Bad query
- **WHEN** the Cypher text has a syntax error
- **THEN** the block displays the error message and the surrounding note renders normally

### Requirement: Large results are bounded
The system SHALL limit graph rendering to a configurable maximum element count and, when exceeded, SHALL show a notice with the count and fall back to a table.

#### Scenario: Result exceeds limit
- **WHEN** a graph result has more elements than the limit
- **THEN** the block shows a notice and offers the table view
