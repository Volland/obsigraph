# cypher-extensions Specification

## Purpose
Defines the additional read-only openCypher clauses and functions the in-plugin engine supports beyond the base subset: staged queries with WITH, optional matches, variable-length paths and aggregations, including grouping and null behavior.

## Requirements

### Requirement: WITH stages a query
The system SHALL support `WITH` to pass selected, renamed or aggregated variables to the next part of a query, and SHALL make only the variables listed in `WITH` visible afterwards.

#### Scenario: Filter on aggregate
- **WHEN** the query `MATCH (a)-[:knows]->(b) WITH a, count(b) AS n WHERE n > 2 RETURN a, n` runs
- **THEN** it returns only nodes with more than two outgoing `knows` edges and their counts

#### Scenario: Out-of-scope variable
- **WHEN** a variable not listed in `WITH` is referenced after it
- **THEN** the system reports an error naming the variable

#### Scenario: Ordering and limit inside WITH
- **WHEN** the query uses `WITH a ORDER BY a.title LIMIT 3` before further matching
- **THEN** only the first three nodes by title continue to the next stage

### Requirement: OPTIONAL MATCH
The system SHALL support `OPTIONAL MATCH`, binding unmatched variables to null and keeping the row from the preceding part.

#### Scenario: Missing relationship yields null
- **WHEN** the query `MATCH (p:Person) OPTIONAL MATCH (p)-[:worksAt]->(c) RETURN p, c` runs and Alice has no `worksAt` edge
- **THEN** a row for Alice is returned with `c` null

#### Scenario: Optional WHERE applies to the optional part
- **WHEN** a `WHERE` follows `OPTIONAL MATCH` and filters out every candidate for a row
- **THEN** the row is kept with the optional variables null instead of being removed

### Requirement: Variable-length paths
The system SHALL support relationship patterns with length bounds such as `*`, `*2`, `*1..3`, `*..3` and `*2..`, with optional type filters, and SHALL NOT traverse the same relationship twice in one path.

#### Scenario: Bounded reachability
- **WHEN** the query `MATCH (a {title: "Alice"})-[:knows*1..3]->(b) RETURN DISTINCT b` runs
- **THEN** it returns every node reachable from Alice by one to three `knows` edges

#### Scenario: Cycles terminate
- **WHEN** the graph has a cycle among `knows` edges and the query uses `*`
- **THEN** the query terminates and no relationship repeats within any returned path

#### Scenario: Unbounded depth is capped
- **WHEN** a query uses `*` without an upper bound
- **THEN** traversal stops at the configured maximum depth and the result indicates that the cap applied

#### Scenario: Path result
- **WHEN** the query binds a path variable `p = (a)-[:knows*1..2]->(b)` and returns `p`
- **THEN** the result is rendered as a graph containing the nodes and relationships along each path

### Requirement: Aggregation functions
The system SHALL support `count`, `sum`, `avg`, `min`, `max` and `collect`, with `count(*)` counting rows, and SHALL ignore nulls in all of them except `count(*)`.

#### Scenario: Count per group
- **WHEN** the query `MATCH (a)-[r:knows]->() RETURN a.title, count(r) AS n ORDER BY n DESC` runs
- **THEN** one row per distinct `a.title` is returned with its edge count, highest first

#### Scenario: Numeric aggregates on edge property
- **WHEN** the query `MATCH ()-[r:rated]->() RETURN avg(r.score), min(r.score), max(r.score), sum(r.score)` runs
- **THEN** a single row with the four values over all rated edges is returned

#### Scenario: Collect values
- **WHEN** the query `MATCH (a)-[:knows]->(b) RETURN a.title, collect(b.title) AS friends` runs
- **THEN** each row has a list of the target titles for that source

#### Scenario: Empty input
- **WHEN** an aggregation without grouping keys runs over zero rows
- **THEN** `count` returns 0, `sum` returns 0 and `avg`, `min`, `max` return null and `collect` returns an empty list

### Requirement: Aggregation type errors
The system SHALL report an error naming the function when `sum` or `avg` receives a non-numeric value.

#### Scenario: Non-numeric sum
- **WHEN** `sum(a.title)` is evaluated over text values
- **THEN** the query fails with an error naming `sum` and the offending value type

### Requirement: Result shapes
The system SHALL give aggregate and list results as scalars so that they render as a table, and SHALL keep nodes, relationships and paths rendering as a graph.

#### Scenario: Aggregate renders as table
- **WHEN** a block's query returns `count(r)` per group
- **THEN** the block renders a table

### Requirement: Remaining unsupported syntax still fails clearly
The system SHALL continue to report clauses and functions outside the supported subset as unsupported, naming the clause or function and pointing at the Ladybug backend.

#### Scenario: Unsupported function
- **WHEN** a query calls a function that is not supported
- **THEN** the error names the function as unsupported in this version

#### Scenario: Writes remain rejected
- **WHEN** a query uses `CREATE` or `SET` after a `WITH`
- **THEN** the query is rejected as read-only
