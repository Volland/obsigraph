## 1. Runtime

- [ ] 1.1 Create `packages/embed` from lat.md's candle engine (MIT, `NOTICE` with attribution); build web and Node targets
- [ ] 1.2 Add CLS pooling and query/passage prefixes to the manifest and engine
- [ ] 1.3 Worker pool: `worker_threads` in Node above 24 texts; one dedicated Web Worker in the plugin
- [ ] 1.4 Publish weights packages: `@typedgraph/embed-minilm-l6` (npm); host `bge-small-en` and `e5-small-multi` weights as pinned release assets with sha256

## 2. Models and fingerprint

- [ ] 2.1 Preset table and custom `ollama/` and `openai/` models wrapping the existing providers
- [ ] 2.2 Fingerprint computation with `CHUNKER_VERSION` and `TEXT_TEMPLATE_VERSION`; record in `StoreMeta`
- [ ] 2.3 Authority rule and the mismatch notice

## 3. Shadow build

- [ ] 3.1 Second store per fingerprint, active pointer, switch on completion, delete old store
- [ ] 3.2 Probe before start; resume after interruption
- [ ] 3.3 `tg reindex [--model id] [--yes]` with progress and an estimate

## 4. Embedding queue and pack

- [ ] 4.1 Replace the no-op queue with pack lookup, batched embedding with yields, progress events
- [ ] 4.2 Vector pack reader, writer, conflict-tolerant scan and pruning over an injected file API
- [ ] 4.3 CLI: blocking catch-up before search, `--no-embed`, `TG_VECTOR_PACK`

## 5. Tests

- [ ] 5.1 Write tests covering every scenario in the local-embedding, vector-pack, embedding-provider and tg-search deltas
- [ ] 5.2 Golden vectors: the WASM runtime matches reference sentence-transformers outputs within cosine 0.999 for each preset

## 6. Evaluation and docs

- [ ] 6.1 Update `lat.md/vector-search.md`, `lat.md/cli.md#Search` and `lat.md/embedded-search.md`; test-spec sections with `@lat:` refs; `tg check`
- [ ] 6.2 Compare `minilm-l6` and `bge-small-en` on a query set over this repository's lat.md and the example vault; record the result and decide the default
