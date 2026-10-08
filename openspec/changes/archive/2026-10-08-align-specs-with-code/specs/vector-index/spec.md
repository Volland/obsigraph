## MODIFIED Requirements

### Requirement: Mismatch blocks writes and offers rebuild
The system SHALL refuse to add vectors when the active embedding provider, model or dimension differs from the stored identity, SHALL report state `mismatch` in status with a message naming both identities and asking for a rebuild, SHALL answer searches from the old index flagged `stale` only when the dimensions are equal and refuse them otherwise, and SHALL discard and re-embed the whole index only when `POST /vectors/rebuild` is called.

#### Scenario: Model changed
- **WHEN** the active model differs from the stored one with the same dimension and a file changes
- **THEN** no vector is written, status reports `mismatch` with a message asking for a rebuild, and searches answer from the old index with `stale: true`

#### Scenario: Rebuild confirmed
- **WHEN** the user confirms the rebuild by calling `POST /vectors/rebuild`
- **THEN** all old vectors are discarded, the vault is re-embedded with the active model and the stored identity is updated

#### Scenario: Dimension changed
- **WHEN** the stored vectors have 768 dimensions and the active model produces 1024
- **THEN** a search fails with an error asking for a rebuild instead of returning scores

### Requirement: Incremental update per file
The system SHALL, when a file changes, re-embed only the chunks and edge sentences whose embedded text changed, reusing the vectors of unchanged text, and SHALL remove vectors that no longer correspond to content. Because a chunk's embedded text includes the note title, renaming a note's file SHALL re-embed its chunks while moving it to another folder under the same file name SHALL NOT.

#### Scenario: One paragraph edited
- **WHEN** one paragraph of a note with five chunks is edited
- **THEN** only the affected chunk is re-embedded and the other four vectors are untouched

#### Scenario: Edge removed
- **WHEN** an edge line is deleted from a note
- **THEN** the sentence vector for that edge is removed from the index

#### Scenario: Note deleted
- **WHEN** a note is deleted
- **THEN** all its chunk vectors and the sentence vectors of its edges are removed

#### Scenario: Note renamed
- **WHEN** a note is moved to another folder without changing its file name
- **THEN** its vectors are re-attributed to the new path without re-embedding unchanged text

#### Scenario: File name changed
- **WHEN** `Alice.md` is renamed to `Alicia.md`
- **THEN** its chunks are re-embedded because the title in their context changed

### Requirement: Combined vector and graph query
The system SHALL let a vector search request over REST or the MCP `vector_search` tool carry a follow-up read-only Cypher query (`then`) that runs after the search with the hit ids bound to `$hits`, returning both results in one response, and SHALL allow filtering node hits by one or more types.

#### Scenario: Vector hits then traversal
- **WHEN** a search request finds the top 3 nodes for "machine learning" and its `then` query matches the `works_at` neighbors of `$hits`
- **THEN** the response returns the companies reached from those three nodes

#### Scenario: Type filter
- **WHEN** a vector search is restricted to type `Person`
- **THEN** only nodes of type `Person` are returned

### Requirement: Unavailable provider degrades gracefully
The system SHALL keep existing vectors intact while the provider is unreachable, SHALL answer searches with HTTP 503 saying embeddings are unavailable (a query cannot be embedded), SHALL record changed files as pending in the vector metadata so they survive a restart, and SHALL embed them automatically when the provider returns.

#### Scenario: Ollama down during edit
- **WHEN** a note is edited while the provider is unreachable
- **THEN** the old vectors are kept, a search answers 503, the file is marked pending, and it is embedded when the provider returns

## ADDED Requirements

### Requirement: Vector index status
`GET /status` SHALL report the vector index state (`building`, `ready`, `degraded` or `mismatch`), a message, the chunk and edge-sentence counts, the number of pending files and the stored embedding identity.

#### Scenario: Pending files shown
- **WHEN** two files changed while the provider was down
- **THEN** status reports state `degraded` and 2 pending files

### Requirement: Vectors can be disabled
With `OBSIGRAPH_VECTORS=0` the system SHALL create no vector storage and SHALL answer vector search and retrieve with HTTP 503 saying vectors are disabled.

#### Scenario: Disabled vectors
- **WHEN** the sidecar starts with `OBSIGRAPH_VECTORS=0` and a client calls `POST /search`
- **THEN** no `vectors/` folder exists in the data directory and the call answers 503
