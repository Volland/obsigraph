## Why

After add-embedded-graph-store, add-local-embedding and add-hybrid-ranking, the CLI and the plugin share one store layout, one set of model presets and fingerprints, and one ranking pipeline. The sidecar still keeps vectors as JSON files under `vectors/` in its data directory, defaults to Ollama `nomic-embed-text` (768 dimensions), scores nodes by best or pooled chunk, and ranks without full-text or graph boost. Four hosts would then answer the same vault with three designs, and the conformance suite could not assert that they agree.

## What Changes

- The sidecar keeps Cards, Chunks and Facts in its native Ladybug mirror through the shared schema, with vector and full-text indexes, and runs the shared ranking pipeline and retrieve from `core`.
- **BREAKING (derived data)**: `vectors/*.json` is retired; the first start after upgrade runs a shadow build into the mirror and then deletes the folder.
- **BREAKING (default)**: the default model becomes the bundled `minilm-l6` preset running in the shared WASM runtime; `OBSIGRAPH_EMBED_MODEL` takes a preset id; `OBSIGRAPH_EMBED_PROVIDER=ollama|openai` keeps working as custom models, so users who set it explicitly keep `nomic-embed-text`.
- `POST /search` and `vector_search` accept `target: nodes|chunks|facts` with `edges` as an alias of `facts`, and `mode: hybrid|lexical|semantic`; `mode: best|pooled` are accepted with a deprecation notice and answered from the pipeline.
- Model changes follow the shadow-build rule: `POST /vectors/rebuild` (and the new `POST /vectors/switch {model}`) builds beside the current index, which keeps answering.
- Status reports the fingerprint, unit counts and waiting units.
- The conformance suite gains a search case: the same vault and model give the same top 10 in plugin, CLI and sidecar.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `vector-index`: storage in the mirror, Card/Chunk/Fact units, shadow builds, fingerprint, status.
- `sidecar-mcp-graphrag`: `vector_search` targets and modes, the hybrid pipeline behind it.
- `sidecar-service`: REST search parameters, default model, status fields.
- `embedding-provider`: the sidecar's default becomes the bundled preset.

## Impact

- `packages/sidecar`: remove `vectors/vector-index.mts` JSON storage; wire the shared queue, pipeline and retrieve; API aliases; Docker image ships the WASM runtime and `minilm-l6` weights (about 50 MB).
- Docs: `lat.md/vector-search.md`, `lat.md/sidecar.md`, compose example, website.
- Tests: engine-conformance search case; existing REST and MCP tests updated for aliases.
