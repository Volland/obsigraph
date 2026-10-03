## 1. Storage

- [x] 1.1 Define the index storage interface and a fake implementation for tests
- [x] 1.2 Store chunk and edge-sentence vectors per note in the sidecar data directory (see design)
- [x] 1.3 Store and read index metadata with model name, dimension and pending queue

## 2. Indexing

- [x] 2.1 Implement full build from the vault using chunking, verbalization and the embedding provider
- [x] 2.2 Implement incremental per-file update by diffing chunk and sentence ids
- [x] 2.3 Handle delete and rename without needless re-embedding
- [x] 2.4 Enforce the model identity check on every write and implement the confirmed rebuild
- [x] 2.5 Queue changes while the provider is unreachable and drain on recovery

## 3. Query

- [x] 3.1 Implement node search with best-chunk aggregation and optional pooling
- [x] 3.2 Implement edge search returning sentences and edge ids
- [x] 3.3 Search with type filter, then traverse via `then` Cypher with `$hits`
- [x] 3.4 Surface rebuild prompt and stale flag in sidecar status and search notices

## 4. Tests

- [x] 4.1 Write tests covering every scenario in the vector-index spec

## 5. Sync

- [x] 5.1 Update lat.md/vector-search and lat.md/ladybug-mirror, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
