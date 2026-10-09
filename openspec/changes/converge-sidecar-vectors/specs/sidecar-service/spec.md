## MODIFIED Requirements

### Requirement: Vector search over REST
The system SHALL provide an authenticated search endpoint that accepts a query text, a target of `nodes`, `chunks` or `facts` (with `edges` as an alias), a mode of `hybrid`, `lexical` or `semantic`, and k, and SHALL report unit counts, waiting units and the model fingerprint in status.

#### Scenario: Vector search over REST
- **WHEN** an authenticated client posts a query text, a target and k
- **THEN** it receives at most k results with scores and citations

#### Scenario: Status shows vectors
- **WHEN** an authenticated client requests status after vectors are built
- **THEN** status includes the Card, Chunk and Fact counts and the model fingerprint

### Requirement: Embedding provider configuration
The system SHALL read the embedding model from configuration, defaulting to the bundled `minilm-l6` preset, SHALL accept custom Ollama and OpenAI-compatible models, and SHALL report a mismatch with the stored index fingerprint instead of writing mixed vectors.

#### Scenario: Provider unreachable at start
- **WHEN** a custom embedding endpoint is unreachable at start
- **THEN** the service still starts, serves graph queries and lexical search, reports vector search as degraded in status and retries embedding

#### Scenario: Model mismatch
- **WHEN** the configured model differs from the stored index model
- **THEN** status reports a mismatch and no vectors are written to the current index until a rebuild or switch is requested
