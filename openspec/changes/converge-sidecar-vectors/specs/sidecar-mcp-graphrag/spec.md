## MODIFIED Requirements

### Requirement: Vector search tool
The system SHALL accept a query text, a target of `nodes`, `chunks` or `facts` (with `edges` accepted as an alias of `facts`), a mode of `hybrid`, `lexical` or `semantic`, an optional node type filter and k, SHALL rank with the shared pipeline, and SHALL return scored results with citations; the former modes `best` and `pooled` SHALL be accepted with a deprecation notice.

#### Scenario: Node search
- **WHEN** an agent calls `vector_search` for nodes with k = 3
- **THEN** it receives at most three results, each with node name, score, note path, heading and the matching text

#### Scenario: Edges alias
- **WHEN** an agent calls `vector_search` with target `edges`
- **THEN** it receives Fact results and no error
