## MODIFIED Requirements

### Requirement: Node score aggregation
The system SHALL represent a node by its Card vector, embedded from the node's own summary text, and SHALL use its Chunks' similarities as separate ranking evidence lifted to the node, instead of pooling chunk vectors. A request for the former `pooled` mode SHALL be answered with Card scores and a deprecation notice.

#### Scenario: Best chunk
- **WHEN** a node has chunks ranked 1st and 9th for a query and its Card ranks 3rd
- **THEN** the node's fused score takes the 1st-ranked chunk and the Card's rank, not the 9th

#### Scenario: Pooled
- **WHEN** a client asks for `mode: pooled`
- **THEN** results are scored by Card and a notice says pooled mode is deprecated
