---
status: accepted
---
# LadybugDB WASM is the embedded graph store; the sidecar stays native

Search needs graph, vector and full-text retrieval offline on desktop, mobile and in the `tg` CLI. We embed LadybugDB's WebAssembly build in every user-facing host: the plugin (desktop and mobile) runs the default async build in a Web Worker, and the `tg` CLI and VS Code extension run the `nodejs/sync` build. The headless sidecar keeps the native `@ladybugdb/core` build. All hosts share one schema module in `core`.

Verified with `@ladybugdb/wasm-core` 0.21.2: the WASM build statically links the VECTOR (HNSW), FTS (BM25), JSON and ALGO extensions, needs no network install and no cross-origin isolation, persists to a file in Node and to IDBFS or OPFS in a WebView, and starts in about 250 ms from the CLI. The native build needs `INSTALL fts` over the network and ships one binary per platform.

This supersedes two earlier rationales: that Ladybug cannot ship in the plugin (true only of the native module), and that vectors stay out of Ladybug because its vector index needs a network-installed extension (true only of the native build).

## Considered Options

- **WASM everywhere, sidecar included.** One engine, but slower bulk mirroring on large vaults and it discards a working native path.
- **Native in Node, WASM only in the plugin.** The CLI would carry per-platform binaries and fetch FTS over the network, breaking "no network by default" in `tg search`.
- **libSQL (as lat.md does).** Native only, no graph traversal in the same query, no mobile.
- **Keep JSON + flat float32 files.** Portable, but no ANN index, no BM25 index and no joint graph-and-vector query.

## Consequences

- The plugin cannot ship a 23 MB engine through the community store (only `main.js`, `manifest.json`, `styles.css`), so the engine must be obtained another way; see the distribution decision.
- Memory: the default buffer pool puts the CLI at about 350 MB RSS; hosts must set an explicit, small buffer pool, especially on mobile.
- The sidecar's native image must pre-install the vector and FTS extensions at build time.
