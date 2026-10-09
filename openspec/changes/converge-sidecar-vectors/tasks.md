## 1. Storage

- [ ] 1.1 Add Card, Chunk and Fact tables to the mirror through the shared schema; pre-install `vector` and `fts` in the image
- [ ] 1.2 Replace JSON `VectorIndex` storage with the shared embedding queue writing into the mirror
- [ ] 1.3 Migration: shadow build from existing `vectors/`, delete it on completion

## 2. Models

- [ ] 2.1 Bundled WASM runtime with a `worker_threads` pool; `OBSIGRAPH_EMBED_MODEL` presets; custom-model mapping for existing variables
- [ ] 2.2 `POST /vectors/rebuild` as a shadow build; new `POST /vectors/switch`
- [ ] 2.3 `-slim` image without weights

## 3. API

- [ ] 3.1 `POST /search` and `vector_search`: targets, modes, aliases, deprecation notices, new response fields
- [ ] 3.2 Retrieve from the shared `core` implementation
- [ ] 3.3 Status fields; degraded instead of 503 for hybrid and semantic when the provider is down

## 4. Tests

- [ ] 4.1 Write tests covering every scenario in the modified vector-index, sidecar-mcp-graphrag, sidecar-service and embedding-provider specs
- [ ] 4.2 Engine-conformance search case: same top 10 across plugin, CLI and sidecar for the example vault

## 5. Docs

- [ ] 5.1 Update `lat.md/vector-search.md`, `lat.md/sidecar.md`, `lat.md/ladybug-mirror.md`, `lat.md/embedded-search.md`, the compose example and the website; `tg check`
