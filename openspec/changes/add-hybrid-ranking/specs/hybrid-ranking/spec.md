## Purpose

Defines what is searchable in a graph store (Cards, Chunks and Facts) and the single ranking pipeline every host uses to turn a query into grouped, explainable node results.

## ADDED Requirements

### Requirement: Three searchable units
The store SHALL hold one Card per vault node, one or more Chunks per node and one Fact per typed edge, each with its embedded text and text hash; Chunks and Facts SHALL have a full-text index; Chunks SHALL link to their node and Facts to their source and target nodes. Lattice sections SHALL have no Card.

#### Scenario: Note with a typed edge
- **WHEN** a note with two sections and one `worksAt` edge is synced
- **THEN** the store holds one Card for the note, two Chunks linked to it and one Fact linked to both endpoints

#### Scenario: Lattice section
- **WHEN** a Lattice section with a leading paragraph and two body paragraphs is synced
- **THEN** the store holds Chunks for the section and no Card

### Requirement: Card text
A vault node's Card text SHALL combine its title, type labels, up to eight scalar properties, its leading paragraph and up to eight outgoing typed edges as verbalized sentences, cut to the model's token limit.

#### Scenario: Card reflects relationships
- **WHEN** a Person note gains a `worksAt:: [[Acme]]` edge
- **THEN** its Card text includes the sentence for that edge and its Card is re-embedded

### Requirement: Only typed edges become Facts
The system SHALL create Facts for typed edges and SHALL NOT create Facts for `contains`, `references` or plain link edges.

#### Scenario: Lattice references
- **WHEN** a Lattice section links to another section with a plain wiki link
- **THEN** no Fact is created for that link

### Requirement: Exact identifiers rank first
The system SHALL record for each Chunk the identifier-like tokens of its text, heading path, node id and file path (tokens containing `_ . / : # @ -`, camelCase or PascalCase tokens with an inner capital, and tokens of at least 40 characters), and when a query is a single such token, nodes whose Chunks contain it SHALL rank above all other results in every mode.

#### Scenario: Identifier query
- **WHEN** the query is `diffMirror`, which appears in one section and nowhere else, and other sections match "diff" and "mirror" in several lists
- **THEN** that section's node ranks first in hybrid, lexical and semantic modes

### Requirement: Ranking pipeline
Search SHALL gather ranked lists through a list-source interface (exact identifiers, full-text over Chunks and Facts, vectors over Chunks, Cards and Facts), lift Chunk hits to their node and Fact hits to their source node with full weight and their target node with half weight, fuse with weighted reciprocal rank fusion, apply the graph boost, place exact-identifier nodes first, and return one result per node with its best Chunk and up to three matching Facts. The same pipeline SHALL run over the graph store and over an in-memory source.

#### Scenario: Meaning query
- **WHEN** the query shares no words with a note that answers it
- **THEN** the note is found in hybrid and semantic modes

#### Scenario: Same ranking from both sources
- **WHEN** one corpus is ranked through the in-memory source and through the graph store with the same model
- **THEN** both return the same node ids in the same order

#### Scenario: Fact lifts its source more than its target
- **WHEN** the query best matches the Fact "Alice works at Acme" and nothing else distinguishes the two nodes
- **THEN** Alice ranks above Acme

### Requirement: Distinct-node candidates
Each list SHALL fetch candidates until it holds 50 distinct nodes or 500 units, so that many Chunks of a few long notes cannot crowd out other nodes.

#### Scenario: Long notes
- **WHEN** three notes each have 40 Chunks matching the query and a fourth note has one matching Chunk
- **THEN** the fourth note is among the candidates of that list

### Requirement: Similarity floor
Vector lists SHALL drop hits whose cosine similarity is below the active preset's floor (0.2 unless the evaluation sets another value), and a search whose lists are all empty SHALL return no results.

#### Scenario: Nonsense query
- **WHEN** `tg search "zxqv flurb" --mode semantic` runs and no unit reaches the floor
- **THEN** the result is empty

### Requirement: Exact vector scan
Vector lists SHALL compare the query vector with every unit's vector, and SHALL use an approximate index only when the store holds more units than the configured threshold (50,000 by default).

#### Scenario: Filtered search below threshold
- **WHEN** a store holds 2,000 Chunks and `tg search sync --type Requirement` runs
- **THEN** the vector list holds every Requirement Chunk above the floor up to the candidate limit, with no approximate misses

### Requirement: Graph boost
The system SHALL raise a node's fused score by a degree-normalized share of the scores of other top-20 nodes joined to it by a typed edge, SHALL cap that raise at a quarter of the score spread between ranks 1 and 20, SHALL ignore `contains`, `references` and plain link edges, and SHALL skip the boost when disabled. Whether it is on by default SHALL follow the evaluation.

#### Scenario: Cluster rises
- **WHEN** the boost is on, two candidates have equal fused scores and only one is joined by typed edges to two other top results
- **THEN** the linked candidate ranks higher

#### Scenario: Parent and child do not boost each other
- **WHEN** a Lattice section and its child section are both in the top 20 and share no typed edge
- **THEN** neither receives a boost

#### Scenario: Hub stays bounded
- **WHEN** a node ranked 18th is joined by typed edges to the other 19 top nodes
- **THEN** its boosted score rises by at most a quarter of the spread between ranks 1 and 20 and it does not reach rank 1

#### Scenario: Boost disabled
- **WHEN** `--no-boost` is given
- **THEN** results are ordered by tier and fused score alone

### Requirement: Search modes
The system SHALL support `hybrid`, `lexical` and `semantic` modes, each including the exact-identifier tier; `lexical` SHALL work with vectors disabled; units still waiting for vectors SHALL be found through full-text lists and counted in the result.

#### Scenario: Lexical without a model
- **WHEN** semantic search is off and a search runs
- **THEN** results come from the exact and full-text lists with lifting, boost and grouping applied

### Requirement: Explainable ranking
On request, each result SHALL list its tier, its rank and similarity in every contributing list, its fused score, its boost and the nodes that caused the boost.

#### Scenario: Explain output
- **WHEN** `tg search q --explain` runs
- **THEN** each hit shows its tier, per-list ranks, the fused score and the boost with its source nodes

### Requirement: Evaluated defaults
Ranking constants (list weights, similarity floors, boost factor) and the default state of Cards, Facts and the graph boost SHALL be set from a labeled query set with a held-out half, and a component that does not improve held-out MRR@10 SHALL be off by default.

#### Scenario: Evaluation report
- **WHEN** the evaluation script runs
- **THEN** it reports MRR@10 and nDCG@10 on the held-out queries for current `tg search`, lat.md, the new pipeline and the pipeline with each of Cards, Facts and the boost removed
