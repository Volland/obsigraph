## 1. Storage

- [ ] 1.1 Define the index storage interface and a fake implementation for tests
- [ ] 1.2 Create Ladybug tables for chunk vectors and edge-sentence vectors linked to nodes and edges
- [ ] 1.3 Store and read index metadata with model name, dimension and pending queue

## 2. Indexing

- [ ] 2.1 Implement full build from the vault using chunking, verbalization and the embedding provider
- [ ] 2.2 Implement incremental per-file update by diffing chunk and sentence ids
- [ ] 2.3 Handle delete and rename without needless re-embedding
- [ ] 2.4 Enforce the model identity check on every write and implement the confirmed rebuild
- [ ] 2.5 Queue changes while the provider is unreachable and drain on recovery

## 3. Query

- [ ] 3.1 Implement node search with best-chunk aggregation and optional pooling
- [ ] 3.2 Implement edge search returning sentences and edge ids
- [ ] 3.3 Expose a Cypher-callable search procedure with type filter and make the in-plugin engine reject it clearly
- [ ] 3.4 Surface rebuild prompt and stale flag in plugin settings or status

## 4. Tests

- [ ] 4.1 Write tests covering every scenario in the vector-index spec

## 5. Sync

- [ ] 5.1 Update lat.md/vector-search and lat.md/ladybug-mirror, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
