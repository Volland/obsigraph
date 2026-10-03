## Purpose

Defines the read-only openCypher subset that users can run against the vault graph, its result shapes and its failure behavior, so the same query text can later run on a heavier backend.

## ADDED Requirements

### Requirement: Supported clauses
The system SHALL support `MATCH`, `WHERE`, `RETURN`, `ORDER BY` and `LIMIT`, including node label patterns, directed and undirected relationship patterns with type filters, and property access on nodes and relationships.

#### Scenario: Typed traversal with filter
- **WHEN** the query `MATCH (a:Person)-[r:knows]->(b) WHERE r.since > 2019 RETURN a, r, b` runs
- **THEN** it returns one row per matching edge with `a`, `r` and `b` bound

#### Scenario: Ordering and limit
- **WHEN** a query ends with `ORDER BY a.title LIMIT 5`
- **THEN** at most five rows are returned sorted by `a.title`

### Requirement: Edge sign and id are queryable
The system SHALL expose each relationship's sign as `r.sign` and its ID as `r.id`, alongside its user-defined properties.

#### Scenario: Filter negative edges
- **WHEN** the query `MATCH (a)-[r]->(b) WHERE r.sign = -1 RETURN a, b` runs
- **THEN** only edges written with a `-` prefix are returned

### Requirement: Read-only
The system SHALL reject `CREATE`, `MERGE`, `SET`, `DELETE` and `REMOVE` and SHALL leave the vault and graph unchanged.

#### Scenario: Write attempt
- **WHEN** the query `CREATE (n:Person)` runs
- **THEN** the system returns an error stating that queries are read-only and no note is created

### Requirement: Unsupported syntax fails clearly
The system SHALL report valid openCypher that is outside the supported subset as unsupported, naming the clause or function, and SHALL report malformed queries as syntax errors with line and column.

#### Scenario: Unsupported clause
- **WHEN** the query uses `OPTIONAL MATCH`
- **THEN** the error names `OPTIONAL MATCH` as unsupported in this version

#### Scenario: Syntax error
- **WHEN** the query is `MATCH (a RETURN a`
- **THEN** the error reports a syntax error with the position of the problem

### Requirement: Result shape
The system SHALL return results as columns of values where each value is a node, a relationship, or a scalar, and SHALL report which kind each column holds.

#### Scenario: Mixed columns
- **WHEN** a query returns `a, r.since`
- **THEN** column `a` is reported as nodes and column `r.since` as scalars

### Requirement: Deterministic stub handling
The system SHALL include stub nodes in matches by default and SHALL expose `n.stub` so queries can exclude them.

#### Scenario: Exclude stubs
- **WHEN** the query `MATCH (n) WHERE n.stub = false RETURN n` runs
- **THEN** only nodes backed by existing notes are returned
