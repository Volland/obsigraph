## Context

LadybugDB provides a vector index and is already the derived store for the graph (v0.3). Putting vectors there lets one query mix similarity and traversal. Motivation: lat.md/vector-search and lat.md/ladybug-mirror. Vector search is therefore desktop-only until the sidecar hosts it.

## Goals / Non-Goals

**Goals:** incremental, identity-safe, combinable with Cypher.

**Non-Goals:** a vector index in the in-plugin engine, hybrid reranking (done in the sidecar change), approximate-index tuning, multi-model coexistence in one index.

## Decisions

**Vectors in Ladybug, separate node tables for chunks and edge sentences linked to graph nodes and relationships.** Alternative, a separate vector database, was rejected because it cannot join with traversal. A chunk node references its note; a sentence node references its edge id.

**Incremental by chunk id.** On file change recompute chunk ids, diff against stored ids, embed only new ones and delete the rest. This relies on the deterministic ids from chunking.

**Search surfaced as a Cypher-callable procedure** returning node or edge, score and chunk, so results feed `MATCH`. Alternative, a separate API only, was rejected as it prevents the combined query. The procedure is Ladybug-only; the in-plugin engine rejects it with a clear unsupported message.

**Single model per index, stored identity checked on every write.** Mismatch stops writes and offers a rebuild, per the embedding-provider spec. Dual indexes were rejected as complexity not needed in v0.4.

**Pending queue persisted in index metadata** so a restart after provider downtime still catches up.

**Assumption:** cosine similarity; vectors are normalized on write.

## Risks / Trade-offs

- [Ladybug vector index API or limits change] -> access through a small storage interface with a fake for tests.
- [Large vault initial embed is slow] -> batch, show progress, resumable via pending queue.
- [Stale results while mismatched] -> flagged stale in results and UI.
- [Rename detection by file system events can look like delete plus add] -> chunk ids use text hash so unchanged text is reused when possible.
