## MODIFIED Requirements

### Requirement: Remaining unsupported syntax still fails clearly
The system SHALL continue to report clauses and functions outside the supported subset with error kind `unsupported` and a message naming the clause or function, and SHALL keep rejecting write clauses anywhere in a query as read-only.

#### Scenario: Unsupported function
- **WHEN** a query calls a function that is not supported, such as `percentileCont`
- **THEN** the error kind is `unsupported` and the message names the function

#### Scenario: Writes remain rejected
- **WHEN** a query uses `CREATE` or `SET` after a `WITH`
- **THEN** the query is rejected as read-only

## ADDED Requirements

### Requirement: Zero-length paths
A variable-length pattern with lower bound 0 SHALL include the start node itself as a match with an empty relationship list.

#### Scenario: Start node included
- **WHEN** `MATCH (a {title: "Alice"})-[:knows*0..1]->(b) RETURN b` runs and Alice knows Bob
- **THEN** the rows contain both Alice and Bob
