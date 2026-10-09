## Why

Search, vectors and graph queries live in three places that cannot meet: the plugin's in-memory graph (no vectors, no full-text index), the CLI's `.tg/vectors.json` plus `.tg/vectors.f32` (vectors only, rewritten on every model change), and the sidecar's native LadybugDB mirror (graph only, vectors kept beside it as JSON). Our documents say Ladybug cannot ship in the plugin and that its vector index needs a network-installed extension. Both are true only of the native build: `@ladybugdb/wasm-core` 0.21.2 statically links the VECTOR (HNSW), FTS (BM25), JSON and ALGO extensions, needs no cross-origin isolation, persists to a file in Node and to IDBFS or OPFS in a WebView, and opens and answers an FTS query in about 250 ms from a cold CLI process. One embedded database can therefore hold the graph, its vectors and its text index on every host, desktop and mobile included, and answer a vector hit plus a graph traversal in one Cypher query.

This change lays that foundation; ranking, embeddings and UI come in later changes (add-local-embedding, add-hybrid-ranking, add-plugin-search, converge-sidecar-vectors). See `docs/adr/0001-ladybug-wasm-as-embedded-graph-store.md` and `docs/adr/0003-per-device-graph-store-shared-vector-pack.md`.

## What Changes

- A `GraphStore` interface in `core` with three drivers: Ladybug WASM async (plugin, in a Worker), Ladybug WASM `nodejs/sync` (CLI, VS Code), and the existing native Ladybug (sidecar).
- One schema module in `core` defines the DDL every host uses (today's mirror layout, plus a store manifest table); the sidecar's `graphRows`/`diffMirror` move from `packages/sidecar/src/mirror/rows.mts` to `core`, replacing `node:crypto` with `core`'s pure hash.
- Two-phase sync, shared by all hosts: Phase 1 applies a signature diff of nodes, edges and text to the store in one transaction and refreshes the FTS indexes; Phase 2 (filled in by add-local-embedding) fills vectors from a queue.
- The CLI keeps its store in `.tg/graph.lbug` (self-ignored like today), catches up before `tg search` and `tg cypher` by stat then hash, and never opens the store from a hook.
- The plugin keeps its store per device in IndexedDB (IDBFS), keyed by vault, never in a synced folder, opened lazily on first use.
- Every host sets an explicit Ladybug buffer pool (default 64 MB, 32 MB on mobile) instead of the engine default.
- A gating spike measures plugin startup with the engine bundled in `main.js` and IDBFS behavior on iOS before add-plugin-search starts.
- **BREAKING (derived data only)**: `.tg/vectors.json` and `.tg/vectors.f32` are replaced by `.tg/graph.lbug`; the old files are deleted on first run.

## Capabilities

### New Capabilities
- `graph-store`: the embedded store abstraction, its drivers, schema module, manifest, location per host, memory limits and rebuild-on-corruption.
- `store-sync`: two-phase incremental sync from markdown into a graph store, catch-up after downtime, and freshness reporting.

### Modified Capabilities
- `ladybug-mirror`: the storage layout is now defined by the shared schema module in `core` rather than by the sidecar.
- `tg-search`: the derived cache becomes `.tg/graph.lbug`.

## Impact

- `packages/core`: `store/` (interface, schema DDL, rows and diff moved from the sidecar, manifest), `sync/` (two-phase driver, embedding queue interface).
- `packages/cli`: WASM driver, `.tg/graph.lbug`, catch-up before search and cypher, removal of `VectorCache`.
- `packages/plugin`: Worker host for the WASM engine, IDBFS location, lazy open; no visible feature yet.
- `packages/sidecar`: imports rows and diff from `core`; behavior unchanged.
- Dependencies: `@ladybugdb/wasm-core` (MIT) in `cli` and `plugin`.
- Bundle: plugin `main.js` grows by about 23 MB (4 MB gzipped), gated by the spike.
