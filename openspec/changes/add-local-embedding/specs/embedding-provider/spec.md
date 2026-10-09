## MODIFIED Requirements

### Requirement: Local default provider
The CLI and the plugin SHALL use the bundled local runtime with the `minilm-l6` preset as the default embedding model when none is configured. The sidecar SHALL keep a local Ollama server at `localhost:11434` with the `nomic-embed-text` model (768 dimensions) as its default until it adopts the shared presets.

#### Scenario: Default configuration
- **WHEN** no model is configured and the CLI embeds text
- **THEN** the bundled runtime produces 384-dimension vectors with `minilm-l6` and no network request is made

#### Scenario: Default is never hosted
- **WHEN** the plugin, the CLI or the sidecar starts with a fresh configuration
- **THEN** no network request is sent to any non-local host for embedding

### Requirement: Model identity is recorded
The system SHALL expose the model fingerprint, display name and vector dimension of the active model so they can be stored with an index.

#### Scenario: Identity reported
- **WHEN** the active model is queried for its identity
- **THEN** it returns its fingerprint, its display name and the dimension of the vectors it produces

### Requirement: Mismatch never mixes vectors
The system SHALL compare the active model's fingerprint with the one stored with an index and, on any difference, SHALL report a mismatch and SHALL NOT add vectors from the active model to that index.

#### Scenario: Model changed
- **WHEN** an index was built with one model and the active model has a different fingerprint
- **THEN** a mismatch is reported, a switch is offered, and no new vectors are written to the existing index

#### Scenario: Same model
- **WHEN** the stored and active fingerprints are identical
- **THEN** no mismatch is reported

### Requirement: Secrets stay out of the vault
The system SHALL NOT write API keys or provider credentials into vault notes, into the index, into the vector pack or anywhere in the data directory. Keys are given to the sidecar through `OBSIGRAPH_EMBED_KEY` or `OBSIGRAPH_EMBED_KEY_FILE`, to the CLI through environment variables, and the plugin stores none because it offers only local models.

#### Scenario: Key configured
- **WHEN** the sidecar starts with `OBSIGRAPH_EMBED_KEY` set and indexes the vault
- **THEN** no file in the vault or the data directory contains the key
