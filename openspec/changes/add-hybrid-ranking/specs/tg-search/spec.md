## MODIFIED Requirements

### Requirement: Search output
`tg search <query> [--limit N] [--mode hybrid|lexical|semantic] [--target nodes|chunks|facts] [--type T,...] [--explain] [--no-boost] [--no-embed] [--then '<cypher>']` SHALL return at most N results (default 5), grouped one per node for `--target nodes` (the default) or as individual Chunks or Facts otherwise; `--lexical` SHALL remain an alias of `--mode lexical`. With `--json` it SHALL print one JSON document holding `mode`, the model display name and fingerprint, any notice, the number of units waiting for vectors, the query, ranked hits with id, score, file, line range, heading path, snippet and matching Facts, per-list ranks when `--explain` is given, and the rows of the `--then` query when given.

#### Scenario: JSON output
- **WHEN** `tg search login --json --lexical` runs
- **THEN** stdout is one JSON document with `mode` `lexical` and up to five hits each giving id, score, file and line range

#### Scenario: Follow-up graph query
- **WHEN** `tg search caching --then 'MATCH (n)-[:implements]->(r) WHERE n.id IN $hits RETURN r.id'` runs
- **THEN** the output holds both the hits and the rows of the follow-up query

#### Scenario: Type filter
- **WHEN** `tg search sync --type Requirement` runs
- **THEN** every hit is a node labeled `Requirement`
