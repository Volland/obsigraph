## MODIFIED Requirements

### Requirement: Corpus grows with the supported subset
The system SHALL derive the supported clauses, operators, functions and aggregates from the in-plugin parser's own tables, and SHALL require each of them to appear as a parsed construct, not a substring, in at least one corpus query.

#### Scenario: New clause added
- **WHEN** a clause is added to the documented supported subset without a corpus query
- **THEN** the suite fails naming the clause

#### Scenario: New function added
- **WHEN** a function is added to the parser's function table and no corpus query calls it
- **THEN** the suite fails naming the function

## ADDED Requirements

### Requirement: Recorded built-in expectations
The corpus SHALL store the expected built-in engine result for every query, the suite SHALL fail for a query without a recorded expectation, and re-recording SHALL happen only when explicitly requested with `OBSIGRAPH_RECORD=1`.

#### Scenario: Missing expectation
- **WHEN** a query is added to `corpus.json` without a recorded result and the suite runs normally
- **THEN** the suite fails naming the query and telling the user to run with `OBSIGRAPH_RECORD=1`
