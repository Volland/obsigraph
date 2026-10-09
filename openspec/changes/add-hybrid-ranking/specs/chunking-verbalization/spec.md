## MODIFIED Requirements

### Requirement: Node score aggregation
The system SHALL represent a vault node by its Card vector, embedded from the node's own summary text, and SHALL use its Chunks' similarities as separate ranking evidence lifted to the node, instead of pooling chunk vectors; a Lattice section, which has no Card, SHALL be represented by its best Chunk. A request for the former `pooled` mode SHALL be answered with Card scores and a deprecation notice.

#### Scenario: Best chunk
- **WHEN** a node has chunks ranked 1st and 9th for a query and its Card ranks 3rd
- **THEN** the node's fused score takes the 1st-ranked chunk and the Card's rank, not the 9th

#### Scenario: Pooled
- **WHEN** a client asks for `mode: pooled`
- **THEN** results are scored by Card and a notice says pooled mode is deprecated

## ADDED Requirements

### Requirement: Chunks sized in model tokens
The chunker SHALL size chunks by the active model's token count, including the context prefix, with a target of 192 tokens for local presets and 512 for remote models, SHALL fall back to 800 characters when no tokenizer is available, and SHALL include the budget in `CHUNKER_VERSION`.

#### Scenario: No silent truncation
- **WHEN** a 2,000-character section is chunked for `minilm-l6`
- **THEN** every chunk, prefix included, is at most 256 tokens, so the model embeds all of its text

#### Scenario: Budget change
- **WHEN** the token target changes in a release
- **THEN** `CHUNKER_VERSION` changes and so does every model fingerprint
