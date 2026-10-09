## 1. Spike (gates add-plugin-search)

- [ ] 1.1 Bundle `@ladybugdb/wasm-core` as a string in a test plugin build and measure cold start on a mid-range Android phone, an iPhone and desktop; pass if startup grows by under 300 ms
- [ ] 1.2 Open an IDBFS-backed store in Obsidian mobile, sync 2,000 notes, kill the app, reopen; record size, memory and persistence behavior
- [ ] 1.3 Check whether OPFS synchronous access handles work in Obsidian's iOS and Android WebViews
- [ ] 1.4 Check whether a Ladybug vector index accepts `SET` on an indexed column that was empty at creation, and time an exact `array_cosine_similarity` scan over 30,000 384-dimension vectors in the WASM build (add-hybrid-ranking scans by default)
- [ ] 1.5 Record results in `design.md` and decide go / revise before add-plugin-search

## 2. Core store

- [ ] 2.1 Define the `GraphStore` interface and the store error kinds in `packages/core/src/store/`
- [ ] 2.2 Move `graphRows`, `diffMirror`, `applyToState`, `propertyTypes` and `relTable` from the sidecar into `core`, using `stableId` for signatures
- [ ] 2.3 Implement the schema module with `StoreMeta`, format version and per-file hashes
- [ ] 2.4 Implement the two-phase sync driver and the `EmbeddingQueue` interface with a no-op queue

## 3. Drivers

- [ ] 3.1 WASM Node sync driver for the CLI and VS Code, with buffer pool option
- [ ] 3.2 WASM async Worker driver for the plugin, created from a bundled string via a Blob URL, with IDBFS mount and explicit persist
- [ ] 3.3 Adapt the sidecar's native store to the interface and the shared schema; pre-install `vector` and `fts` in the Docker image

## 4. Hosts

- [ ] 4.1 CLI: `.tg/graph.lbug`, catch-up by stat and hash before `search` and `cypher`, delete old vector files, remove `VectorCache`
- [ ] 4.2 Plugin: lazy open on first use, vault-keyed location, structural sync on `VaultIndex` notifications, catch-up at first open
- [ ] 4.3 Corruption handling and rebuild-once on every host

## 5. Tests

- [ ] 5.1 Write tests covering every scenario in the graph-store and store-sync specs
- [ ] 5.2 Conformance: the same vault through WASM and native drivers gives the same rows for the engine-conformance query set
- [ ] 5.3 Property test: random edit sequences synced incrementally equal a fresh build

## 6. Docs and sync

- [ ] 6.1 Update `lat.md/ladybug-mirror.md`, `lat.md/cli.md#Search` and `lat.md/embedded-search.md`; add test-spec sections with `@lat:` refs; run `tg check`
