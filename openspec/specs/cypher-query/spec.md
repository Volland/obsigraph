# cypher-query Specification

## Purpose
Defines the read-only openCypher subset that users can run against the vault graph, its result shapes and its failure behavior, so the same query text can later run on a heavier backend.

## Requirements

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
The system SHALL report valid openCypher that is outside the supported subset, including list comprehensions, map projections, pattern predicates and subqueries, with error kind `unsupported` and a message naming the clause, function or construct, and SHALL report malformed queries as syntax errors with line and column.

#### Scenario: Unsupported clause
- **WHEN** the query uses `UNWIND`
- **THEN** the error kind is `unsupported` and the message names `UNWIND`

#### Scenario: Syntax error
- **WHEN** the query is `MATCH (a RETURN a`
- **THEN** the error reports a syntax error with the position of the problem

#### Scenario: Unsupported expression construct
- **WHEN** the query is `MATCH (n) RETURN [x IN labels(n) | toLower(x)]`
- **THEN** the error kind is `unsupported` and the message names the list comprehension

### Requirement: Result shape
The system SHALL return results as columns of values where each value is a node, a relationship, a path, or a scalar, and SHALL report which kind each column holds.

#### Scenario: Mixed columns
- **WHEN** a query returns `a, r.since`
- **THEN** column `a` is reported as nodes and column `r.since` as scalars

#### Scenario: Path column
- **WHEN** a query binds `p = (a)-[:knows*1..2]->(b)` and returns `p`
- **THEN** column `p` is reported as paths

### Requirement: Deterministic stub handling
The system SHALL include stub nodes in matches by default and SHALL expose `n.stub` so queries can exclude them.

#### Scenario: Exclude stubs
- **WHEN** the query `MATCH (n) WHERE n.stub = false RETURN n` runs
- **THEN** only nodes backed by existing notes are returned

### Requirement: Query parameters
The system SHALL accept named parameters (`$name`) supplied with a query and SHALL fail with a runtime error naming the parameter when a referenced parameter is not supplied.

#### Scenario: Parameter supplied
- **WHEN** `MATCH (p:Person) WHERE p.title = $name RETURN p` runs with `name` = `Alice`
- **THEN** it returns the `Alice` node

#### Scenario: Parameter missing
- **WHEN** the same query runs with no parameters
- **THEN** it fails with a runtime error naming `$name`

### Requirement: Error kinds
Every query failure SHALL carry exactly one kind of `syntax`, `unsupported`, `readonly`, `runtime` or `timeout`, so hosts can label the error and map it to a status (the sidecar answers `timeout` with HTTP 504).

#### Scenario: Write rejected with its kind
- **WHEN** the query is `CREATE (n:Person)`
- **THEN** the failure kind is `readonly`

### Requirement: Query timeout
The system SHALL abort a query that runs longer than the timeout its host configures and SHALL report it with error kind `timeout`.

#### Scenario: Long traversal aborted
- **WHEN** a query over a large graph exceeds a configured timeout of 10 ms
- **THEN** it stops and fails with kind `timeout` instead of returning partial rows
