---
openspec: [graph-store, store-sync, local-embedding, vector-pack, hybrid-ranking, tg-retrieve, plugin-search, model-setup]
---
# Embedded Search

Planned: one embedded LadybugDB graph store per host holding graph, text and vectors, a bundled local embedding model, and one hybrid ranking pipeline for CLI, plugin (desktop and mobile) and sidecar.

Nothing here is implemented yet. It is specified by five OpenSpec changes, built in order: add-embedded-graph-store, add-local-embedding, add-hybrid-ranking, add-plugin-search, converge-sidecar-vectors. Decisions with lasting trade-offs are recorded in `docs/adr/` 0001 to 0003, and the vocabulary (Graph store, Card, Chunk, Fact, Model fingerprint, Shadow build, Vector pack, Graph boost, Context pack) in `CONTEXT.md`. When a change lands, its part of this page moves into [[vector-search]], [[ladybug-mirror]], [[cli#Search]] or [[sidecar]].

## Graph store per host

Every host keeps a derived LadybugDB database beside its corpus, through one `GraphStore` interface and one schema module in `core`.

The WASM build (`@ladybugdb/wasm-core` 0.21.2) statically links the vector (HNSW), full-text (BM25), JSON and algorithm extensions, needs no network install and no cross-origin isolation, and opens in about 250 ms from a cold CLI process. The plugin runs its async build in a Worker, the CLI and VS Code its Node sync build, and the sidecar keeps the native build with the extensions pre-installed. Vector and full-text indexes exist only on node tables, so searchable edges are reified. Locations: `.tg/graph.lbug` in the CLI, per-device IndexedDB in the plugin (never a synced folder), the data directory in the sidecar.

## Two-phase sync

Markdown reaches the store silently: a structural phase applies a signature diff in one transaction, and a vector phase fills embeddings from a queue without blocking it.

The diff is the sidecar's `diffMirror`, moved into `core`. The plugin syncs after `VaultIndex`'s debounced notifications, the CLI catches up by stat and hash before `search`, `retrieve` and `cypher`, and hooks never open the store. On mobile the vector phase runs only while the app is open and idle.

## Local embedding model

The CLI pre-bundles all-MiniLM-L6-v2 (lat.md's model) in a candle WASM runtime, so search is hybrid offline with no setup; the plugin downloads weights only on request.

Presets: `minilm-l6` (English, default), `bge-small-en` (English) and `e5-small-multi` (about 100 languages), plus custom Ollama and OpenAI-compatible models. MiniLM's vocabulary is English-only, so the plugin samples a vault's script mix at first run and recommends the multilingual preset above 10% non-Latin letters. A model fingerprint covers weights, pooling, prefixes, chunker and text templates; the stored fingerprint is authoritative and a change runs as a shadow build while the old index keeps answering. The plugin ships all code in `main.js` and downloads only weights, verified by sha256, because Obsidian's policies forbid installing dependencies at runtime.

## Searchable units and ranking

Each node has a Card (what it is), Chunks (where things are said) and, for typed edges, Facts (which relationship), each with vector and full-text indexes.

The pipeline gathers up to six lists, lifts Chunk and Fact hits to nodes, fuses them with weighted reciprocal rank fusion, adds a graph boost for hits linked to other top hits, and groups one result per node. `tg search` gains modes, targets, type filters, `--explain` and `--then`; `tg retrieve` and MCP `tg_retrieve` return the sidecar's context-pack contract.

## Plugin search and devices

The plugin gets a search view with an always-visible model status, a related-notes panel, and a copyable context pack; the model choice is per vault, semantic search can be off per device.

Devices share embeddings through a vector pack: content-addressed files of float16 vectors under the synced plugin folder, one per note version, so a phone reuses what a laptop embedded and sync conflicts are harmless.
