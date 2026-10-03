# vector-index Specification

## Purpose
Defines the vector index over note chunks and edge sentences, how it stays in sync with the vault, and how vector search combines with graph traversal in one query.

## Requirements

### Requirement: Index covers nodes and edges
The system SHALL index every note chunk and every edge sentence, and SHALL attribute each vector to its node or edge.

#### Scenario: Note and edge indexed
- **WHEN** a vault with one note containing two chunks and one edge is indexed
- **THEN** the index holds two chunk vectors attributed to the node and one sentence vector attributed to the edge

### Requirement: Index records model identity
The system SHALL store the embedding model name and dimension with the index.

#### Scenario: Metadata stored
- **WHEN** an index is built with `nomic-embed-text`
- **THEN** the index metadata records that model name and dimension 768

### Requirement: Mismatch blocks writes and offers rebuild
The system SHALL refuse to add vectors when the active embedding model or dimension differs from the stored identity, SHALL tell the user a rebuild is needed, and SHALL rebuild the whole index with the new model only on explicit confirmation.

#### Scenario: Model changed
- **WHEN** the active model differs from the stored one and a file changes
- **THEN** no vector is written, a rebuild prompt is surfaced and searches continue against the old index flagged as stale

#### Scenario: Rebuild confirmed
- **WHEN** the user confirms the rebuild
- **THEN** all old vectors are discarded, the vault is re-embedded with the active model and the stored identity is updated

### Requirement: Incremental update per file
The system SHALL, when a file changes, re-embed only the chunks and edge sentences whose text changed, and SHALL remove vectors that no longer correspond to content.

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
- **WHEN** a note is renamed
- **THEN** its vectors are re-attributed to the new path without re-embedding unchanged text

### Requirement: Vector search over nodes
The system SHALL return the top-k nodes most similar to a query text, each with a score and the best matching chunk.

#### Scenario: Top nodes
- **WHEN** a query is searched with k = 5
- **THEN** at most five nodes are returned ordered by descending score, each with its best chunk's path and heading

### Requirement: Vector search over edges
The system SHALL return the top-k edges most similar to a query text, each with a score and its sentence.

#### Scenario: Relationship query
- **WHEN** the query is "who did Alice meet at a conference"
- **THEN** edges whose sentences match are returned with their scores, sentences and edge identifiers

### Requirement: Combined vector and graph query
The system SHALL allow vector search results to be used as the starting set of a graph traversal within a single query, and SHALL allow filtering vector hits by node type.

#### Scenario: Vector hits then traversal
- **WHEN** a query finds the top 3 nodes for "machine learning" and then matches their `works_at` neighbors
- **THEN** it returns the companies reached from those three nodes

#### Scenario: Type filter
- **WHEN** a vector search is restricted to type `Person`
- **THEN** only nodes of type `Person` are returned

### Requirement: Index is derived and rebuildable
The system SHALL be able to delete the index and rebuild it from markdown alone, and SHALL NOT treat the index as a source of truth.

#### Scenario: Index deleted
- **WHEN** the index storage is removed and a rebuild runs
- **THEN** the resulting search results equal those from before the deletion for an unchanged vault and model

### Requirement: Unavailable provider degrades gracefully
The system SHALL keep existing vectors queryable and SHALL queue changed files for later embedding when the provider is unreachable.

#### Scenario: Ollama down during edit
- **WHEN** a note is edited while the provider is unreachable
- **THEN** the old vectors remain searchable, the file is marked pending, and it is embedded when the provider returns
