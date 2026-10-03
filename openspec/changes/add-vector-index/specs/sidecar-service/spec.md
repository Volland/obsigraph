## ADDED Requirements

### Requirement: Vector search over REST
The system SHALL provide an authenticated vector search endpoint that accepts a query text, a target of nodes or edges, and k, and SHALL report vector count and embedding model in status.

#### Scenario: Vector search over REST
- **WHEN** an authenticated client posts a query text, a target of nodes or edges, and k
- **THEN** it receives at most k results with scores and citations

#### Scenario: Status shows vectors
- **WHEN** an authenticated client requests status after vectors are built
- **THEN** status includes the vector count and the embedding model identity

### Requirement: Embedding provider configuration
The system SHALL read the embedding provider from configuration, defaulting to local Ollama, and SHALL report a mismatch with the stored index identity instead of writing mixed vectors.

#### Scenario: Provider unreachable at start
- **WHEN** the embedding endpoint is unreachable at start
- **THEN** the service still starts, serves graph queries, reports vector search as degraded in status and retries embedding

#### Scenario: Model mismatch
- **WHEN** the configured model differs from the stored index model
- **THEN** status reports a mismatch and no vectors are written until a rebuild is requested explicitly
