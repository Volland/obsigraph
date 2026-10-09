## Purpose

Defines what is searchable in a graph store (Cards, Chunks and Facts) and the single ranking pipeline every host uses to turn a query into grouped, explainable node results.

## ADDED Requirements

### Requirement: Three searchable units
The store SHALL hold one Card per node, one or more Chunks per node and one Fact per typed edge, each with its embedded text, text hash, a vector index and a full-text index; Chunks SHALL link to their node and Facts to their source and target nodes.

#### Scenario: Note with a typed edge
- **WHEN** a note with two sections and one `worksAt` edge is synced
- **THEN** the store holds one Card for the note, two Chunks linked to it and one Fact linked to both endpoints

### Requirement: Card text
A node's Card text SHALL combine its title, type labels, up to eight scalar properties, its leading paragraph and up to eight outgoing typed edges as verbalized sentences; a Lattice section's Card SHALL be its heading path and leading paragraph.

#### Scenario: Card reflects relationships
- **WHEN** a Person note gains a `worksAt:: [[Acme]]` edge
- **THEN** its Card text includes the sentence for that edge and its Card is re-embedded

### Requirement: Only typed edges become Facts
The system SHALL create Facts for typed edges and SHALL NOT create Facts for `contains`, `references` or plain link edges.

#### Scenario: Lattice references
- **WHEN** a Lattice section links to another section with a plain wiki link
- **THEN** no Fact is created for that link

### Requirement: Ranking pipeline
Search SHALL gather the top 50 of each available list (vector and full-text over Card, Chunk and Fact), lift Chunk hits to their node and Fact hits to both endpoints, fuse with weighted reciprocal rank fusion, apply the graph boost, and return one result per node with its best Chunk and up to three matching Facts.

#### Scenario: Identifier query
- **WHEN** the query is an exact function name that appears in one section and nowhere else
- **THEN** that section's node ranks first in hybrid mode

#### Scenario: Meaning query
- **WHEN** the query shares no words with a note that answers it
- **THEN** the note is found in hybrid and semantic modes

### Requirement: Graph boost
The system SHALL raise a node's fused score in proportion to the scores of other top-20 nodes it is directly linked to, capped at half of its own score, SHALL apply it by default, and SHALL skip it when disabled.

#### Scenario: Cluster rises
- **WHEN** two candidates have equal fused scores and only one is linked to two other top results
- **THEN** the linked candidate ranks higher

#### Scenario: Boost disabled
- **WHEN** `--no-boost` is given
- **THEN** results are ordered by fused score alone

### Requirement: Search modes
The system SHALL support `hybrid`, `lexical` and `semantic` modes; `lexical` SHALL work with vectors disabled; units still waiting for vectors SHALL be found through full-text lists and counted in the result.

#### Scenario: Lexical without a model
- **WHEN** semantic search is off and a search runs
- **THEN** results come from the full-text lists with lifting, boost and grouping applied

### Requirement: Explainable ranking
On request, each result SHALL list its rank in every contributing list, its fused score, its boost and the nodes that caused the boost.

#### Scenario: Explain output
- **WHEN** `tg search q --explain` runs
- **THEN** each hit shows per-list ranks, the fused score and the boost with its source nodes
