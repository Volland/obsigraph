## MODIFIED Requirements

### Requirement: Index covers nodes and edges
The system SHALL index one Card per node, every Chunk of every note and one Fact per typed edge in the mirror's graph store, and SHALL link each Chunk to its node and each Fact to its source and target nodes.

#### Scenario: Note and edge indexed
- **WHEN** a vault with one note containing two chunks and one typed edge is indexed
- **THEN** the index holds one Card and two Chunks for the node and one Fact linked to both endpoints

### Requirement: Index records model identity
The system SHALL store the embedding model's fingerprint, display name and dimension with the index.

#### Scenario: Metadata stored
- **WHEN** an index is built with the `minilm-l6` preset
- **THEN** the index metadata records its fingerprint, the name `minilm-l6` and dimension 384

### Requirement: Mismatch blocks writes and offers rebuild
The system SHALL refuse to add vectors when the active model's fingerprint differs from the stored one, SHALL report state `mismatch` in status naming both models, SHALL keep answering from the current index with its own model, and SHALL build an index for the active model beside the current one when `POST /vectors/rebuild` or `POST /vectors/switch` is called, replacing the current index only when the new one is complete.

#### Scenario: Model changed
- **WHEN** the configured model differs from the stored one and a file changes
- **THEN** no vector is written to the current index, status reports `mismatch`, and searches still answer from the current index

#### Scenario: Rebuild confirmed
- **WHEN** the user calls `POST /vectors/rebuild`
- **THEN** a new index is built for the configured model while searches keep answering from the old one, and the new index replaces it on completion

#### Scenario: Dimension changed
- **WHEN** the stored vectors have 384 dimensions and the configured model produces 768
- **THEN** searches keep answering from the current index with its own model, and no score is ever computed between vectors of different dimensions

#### Scenario: Switch by name
- **WHEN** a client calls `POST /vectors/switch` with model `e5-small-multi`
- **THEN** a shadow build for that preset starts and status reports its progress

### Requirement: Vector index status
`GET /status` SHALL report the vector index state (`building`, `ready`, `degraded`, `mismatch` or `switching`), a message, the Card, Chunk and Fact counts, the number of units waiting for vectors, the stored fingerprint and model name, and the progress of a shadow build.

#### Scenario: Pending files shown
- **WHEN** two files changed while the provider was down
- **THEN** status reports state `degraded` and the units of those files as waiting

### Requirement: Unavailable provider degrades gracefully
The system SHALL keep existing vectors intact while the provider is unreachable, SHALL keep structural sync and full-text search working, SHALL answer hybrid and semantic searches with lexical results flagged `degraded: true`, SHALL record changed units as waiting so they survive a restart, and SHALL embed them automatically when the provider returns.

#### Scenario: Ollama down during edit
- **WHEN** a note is edited while a custom Ollama provider is unreachable
- **THEN** the old vectors are kept, a hybrid search answers with lexical results and `degraded: true`, and the note's units are embedded when the provider returns

### Requirement: Vectors can be disabled
With `OBSIGRAPH_VECTORS=0` the system SHALL create no vector columns or indexes, SHALL answer semantic search with HTTP 503 saying vectors are disabled, and SHALL answer lexical search and retrieve from full-text lists.

#### Scenario: Disabled vectors
- **WHEN** the sidecar starts with `OBSIGRAPH_VECTORS=0` and a client calls `POST /search` with `mode: semantic`
- **THEN** the call answers 503, and the same call with `mode: lexical` returns results
