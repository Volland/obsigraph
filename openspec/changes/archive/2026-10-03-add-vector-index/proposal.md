## Why

Chunks and edge sentences need a searchable store that can be combined with graph traversal. Ladybug already holds the mirrored graph, so the vector index lives beside it. See lat.md/vector-search and lat.md/ladybug-mirror.

## What Changes

- Store chunk and edge-sentence vectors in LadybugDB, with the model name and dimension recorded as index metadata.
- Update the index incrementally per changed, renamed or deleted file.
- Offer vector search over nodes and edges, usable in the same query as graph traversal.
- On embedding model mismatch, refuse to write and offer a full rebuild.

## Capabilities

### New Capabilities
- `vector-index`: Incrementally maintained vector index over nodes and edges, queryable with graph traversal.

### Modified Capabilities

## Impact

- New module in `packages/core` (index logic against a storage interface) and the Ladybug-backed implementation. Depends on `embedding-provider`, `chunking-verbalization` and the Ladybug mirror from v0.3.
- Assumptions: the Ladybug mirror exists and is the only store for vectors; the in-plugin engine does not get vector search, so it is desktop-only until the sidecar hosts it. Combined querying is exposed as a Cypher-callable vector search procedure that yields nodes or edges with a score; exact syntax is a design choice recorded in design.md.
