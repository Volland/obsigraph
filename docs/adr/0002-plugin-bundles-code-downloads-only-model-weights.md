---
status: accepted
---
# The plugin bundles all code and downloads only model weights

Obsidian's developer policies forbid plugins to "install or update themselves or their dependencies", and an automated review scans every release. So the plugin's `main.js` carries the LadybugDB WASM engine and the embedding runtime as inert strings, instantiated in a Worker only on first search, and the only thing ever downloaded is the embedding model's weights: data, fetched from a pinned URL, verified by sha256, and only after the user turns semantic search on. The README discloses that download. Without weights the plugin still offers graph-aware BM25 search, offline.

The `tg` CLI has no such constraint and pre-bundles the default model as an npm dependency, so `tg search` is hybrid with no setup.

## Considered Options

- **Bundle the weights in `main.js` too** (~85 MB): no network ever, but mobile parse time and memory at every startup and an 85 MB download on every plugin update.
- **Download engine and weights on first use** (lat.md's approach): smallest plugin, but downloading the engine is installing a dependency and risks removal from the community directory.
- **No Ladybug in the plugin** (pure-JS BM25 and flat vectors): lightest, but a second ranking implementation and no joint graph-and-vector query.

## Consequences

- Startup cost of a ~27 MB `main.js` on mobile must be measured by a spike before the design is final.
- Any future change that fetches executable code (engine, tokenizer code, model runtime) at runtime violates this decision.
