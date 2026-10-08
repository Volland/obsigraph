## MODIFIED Requirements

### Requirement: Degraded retrieval without vectors
The system SHALL return a clear error stating embeddings are unavailable from vector search and retrieve when the embedding provider is unreachable or vectors are disabled. When the index model mismatches the active model, both tools SHALL answer from the existing index with `stale: true` and a notice naming both models if the dimensions are equal, and SHALL return an error asking for a rebuild if they differ. `cypher_query` SHALL keep working in every case.

#### Scenario: Provider down
- **WHEN** the embedding endpoint is unreachable and an agent calls `graphrag_retrieve`
- **THEN** the tool returns an error stating embeddings are unavailable, and a following `cypher_query` call succeeds

#### Scenario: Model mismatch with equal dimensions
- **WHEN** the index was built with one 768-dimension model, the active model is another 768-dimension model and an agent calls `graphrag_retrieve`
- **THEN** the answer has `stale: true` and a notice naming both models

#### Scenario: Model mismatch with different dimensions
- **WHEN** the index has 768-dimension vectors, the active model produces 1024 dimensions and an agent calls `vector_search`
- **THEN** the tool returns an error asking for a rebuild and no similarity score is computed

## ADDED Requirements

### Requirement: Untrusted content marking
The system SHALL mark returned chunk text as untrusted vault content, to be treated as data and not as instructions, in every retrieve response and in the descriptions of the search and retrieve tools.

#### Scenario: Notice in the response
- **WHEN** an agent calls `graphrag_retrieve`
- **THEN** the response includes the untrusted-content notice next to the chunks

### Requirement: Retrieve parameter bounds
The system SHALL accept retrieve parameters within documented ranges and defaults (`k` 1–50, default 5; `depth` 0–3, default 1; `neighbor_cap` 1–50, default 8; `chunk_cap` 1–100, default 20) and SHALL reject an out-of-range value as a client error naming the parameter (HTTP 400 over REST, a tool error over MCP).

#### Scenario: Depth too large
- **WHEN** an agent calls `graphrag_retrieve` with `depth` 5
- **THEN** the call fails with an error naming `depth` and its range

### Requirement: Server identity
The MCP server SHALL identify itself as `typed-graph` with the version of the installed sidecar package.

#### Scenario: Version reported
- **WHEN** an MCP client initializes a session with sidecar 0.9.1
- **THEN** the server info reports name `typed-graph` and version `0.9.1`
