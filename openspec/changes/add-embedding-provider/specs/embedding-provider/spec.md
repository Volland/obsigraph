## Purpose

Defines how the system obtains text embeddings from a configurable provider, with a local default, support for OpenAI-compatible endpoints, and guarantees that vectors from different models are never mixed.

## ADDED Requirements

### Requirement: Local default provider
The system SHALL use a local Ollama server at `localhost:11434` with the `nomic-embed-text` model (768 dimensions) as the default embedding provider when no provider is configured.

#### Scenario: Default configuration
- **WHEN** no provider is configured and text is embedded
- **THEN** the request goes to the local Ollama endpoint using `nomic-embed-text` and each returned vector has 768 dimensions

#### Scenario: Default is never hosted
- **WHEN** the plugin or sidecar starts with a fresh configuration
- **THEN** no network request is sent to any non-local host for embedding

### Requirement: OpenAI-compatible endpoints
The system SHALL allow the user to configure any OpenAI-compatible embeddings endpoint by base URL, model name and optional API key.

#### Scenario: Custom endpoint
- **WHEN** the user configures a base URL, model name and API key and text is embedded
- **THEN** the system requests embeddings from that endpoint with that model and returns one vector per input text in input order

### Requirement: Batch embedding
The system SHALL embed multiple texts in a single call and SHALL return exactly one vector per input, in order.

#### Scenario: Batch of three
- **WHEN** three texts are embedded together
- **THEN** three vectors are returned matching the input order

### Requirement: Provider failure reporting
The system SHALL report an actionable error that names the endpoint and cause when the provider is unreachable, the model is missing, or the response is malformed, and SHALL NOT return partial or zero vectors.

#### Scenario: Ollama not running
- **WHEN** the local endpoint refuses the connection
- **THEN** the embedding call fails with an error naming the endpoint and no vectors are produced

#### Scenario: Model not installed
- **WHEN** the endpoint reports the configured model is not available
- **THEN** the error names the model and suggests installing it, and nothing is pulled automatically

### Requirement: Model identity is recorded
The system SHALL expose the model name and vector dimension of the active provider so they can be stored with an index.

#### Scenario: Identity reported
- **WHEN** the active provider is queried for its identity
- **THEN** it returns the model name and the dimension of the vectors it produces

### Requirement: Mismatch never mixes vectors
The system SHALL compare the active provider's model name and dimension with those stored with an index and, on any difference, SHALL report a mismatch and SHALL NOT add vectors from the active provider to that index.

#### Scenario: Model changed
- **WHEN** an index was built with `nomic-embed-text` and the active model is now a different model
- **THEN** a mismatch is reported, a rebuild is offered, and no new vectors are written to the existing index

#### Scenario: Same model
- **WHEN** the stored and active model name and dimension are identical
- **THEN** no mismatch is reported

### Requirement: Secrets stay out of the vault
The system SHALL NOT write API keys or provider credentials into vault notes or into the index.

#### Scenario: Key configured
- **WHEN** the user saves an API key in settings
- **THEN** the key is stored only in plugin settings or environment configuration, never in any note
