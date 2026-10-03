## Purpose

Defines a conformance suite that runs one set of queries against both query engines, reports where they disagree, and records which differences are intentional, so the engines cannot drift apart unnoticed.

## ADDED Requirements

### Requirement: Shared corpus on a fixed fixture
The system SHALL maintain a corpus of queries and a committed fixture vault, and SHALL run every query in the corpus against both engines on the same graph.

#### Scenario: Both engines run
- **WHEN** the suite runs with Ladybug available
- **THEN** each corpus query is executed on the in-plugin engine and on the Ladybug backend against the same fixture

#### Scenario: Fixture coverage
- **WHEN** the fixture is inspected
- **THEN** it includes multi-label nodes, stubs, positive and negative edges, pinned ids, parallel edges and edge properties

### Requirement: Comparison rules
The system SHALL compare results by column names, column kinds and row multiset, SHALL compare row order only for queries with `ORDER BY`, and SHALL normalize equivalent value forms (such as integer and float representations) before comparing.

#### Scenario: Unordered query
- **WHEN** a query without `ORDER BY` returns the same rows in different order on each engine
- **THEN** it is reported as a match

#### Scenario: Ordered query
- **WHEN** a query with `ORDER BY` returns rows in a different order
- **THEN** it is reported as a divergence

#### Scenario: Different column kind
- **WHEN** the engines report different kinds for the same column
- **THEN** it is reported as a divergence

### Requirement: Divergences are reported and fail the run
The system SHALL produce a report listing each query with its outcome of match, divergence, expected difference or skipped, SHALL show both results for divergences, and SHALL fail the run on any divergence not classified as expected.

#### Scenario: Unexpected divergence
- **WHEN** a query returns different rows on the two engines and has no documented difference
- **THEN** the report shows both results and the run fails

#### Scenario: All match
- **WHEN** every query matches or is an expected difference
- **THEN** the run passes and the report summarizes counts per outcome

### Requirement: Documented intentional differences
The system SHALL keep a documented list of intentionally unsupported subset differences, where each entry names the construct, the in-plugin engine's behavior and the Ladybug behavior, and SHALL link each entry to at least one corpus query that exercises it.

#### Scenario: Construct unsupported in-plugin
- **WHEN** a corpus query uses a clause the in-plugin engine rejects as unsupported and Ladybug runs
- **THEN** it is reported as an expected difference citing the documented entry

#### Scenario: Entry without a query
- **WHEN** a documented difference has no corpus query exercising it
- **THEN** the suite fails with a message naming the entry

#### Scenario: Stale entry
- **WHEN** a documented difference no longer occurs because both engines now agree
- **THEN** the suite flags the entry as stale and fails until it is removed

### Requirement: Write rejection conformance
The system SHALL include write-clause queries in the corpus and SHALL require both engines to reject each with a read-only error and leave the graph unchanged.

#### Scenario: Both reject writes
- **WHEN** `CREATE (n:Person)` runs on both engines
- **THEN** both return a read-only error and the fixture graph is unchanged

### Requirement: Graceful skip when Ladybug is unavailable
The system SHALL skip the Ladybug half when LadybugDB is unavailable, SHALL mark affected queries as skipped with the reason, and SHALL still verify the in-plugin engine against recorded expected results.

#### Scenario: Ladybug not installed in CI
- **WHEN** the suite runs without LadybugDB
- **THEN** Ladybug comparisons are reported as skipped with the reason and in-plugin results are checked against recorded expectations

### Requirement: Corpus grows with the supported subset
The system SHALL require every clause and function the in-plugin engine documents as supported to appear in at least one corpus query.

#### Scenario: New clause added
- **WHEN** a clause is added to the documented supported subset without a corpus query
- **THEN** the suite fails naming the clause
