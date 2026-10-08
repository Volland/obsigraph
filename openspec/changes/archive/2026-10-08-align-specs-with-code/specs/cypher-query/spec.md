## MODIFIED Requirements

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

## ADDED Requirements

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
