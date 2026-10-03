## MODIFIED Requirements

### Requirement: Unsupported syntax fails clearly
The system SHALL report valid openCypher that is outside the supported subset as unsupported, naming the clause or function, and SHALL report malformed queries as syntax errors with line and column.

#### Scenario: Unsupported clause
- **WHEN** the query uses `UNWIND`
- **THEN** the error names `UNWIND` as unsupported in this version

#### Scenario: Syntax error
- **WHEN** the query is `MATCH (a RETURN a`
- **THEN** the error reports a syntax error with the position of the problem

### Requirement: Result shape
The system SHALL return results as columns of values where each value is a node, a relationship, a path, or a scalar, and SHALL report which kind each column holds.

#### Scenario: Mixed columns
- **WHEN** a query returns `a, r.since`
- **THEN** column `a` is reported as nodes and column `r.since` as scalars

#### Scenario: Path column
- **WHEN** a query binds `p = (a)-[:knows*1..2]->(b)` and returns `p`
- **THEN** column `p` is reported as paths
