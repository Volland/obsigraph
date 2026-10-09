## Why

Hybrid search in `tg` needs Ollama or an API key, so almost every user gets lexical results only, and the plugin cannot embed at all. lat.md shows that a small bundled model (all-MiniLM-L6-v2, fp16 weights, candle compiled to WASM) gives offline semantic search with no setup. It also shows the hazards: an index recorded only as `name:dims` cannot tell two 384-dimension models apart, and a model change that drops the index leaves nothing to search until the rebuild ends. Our CLI is worse on one point: when the model label changes, the next search silently re-embeds everything.

This change adds a bundled local embedding runtime, a small set of model presets, a model fingerprint that covers everything that changes a vector, a shadow build for model changes, and a content-addressed vector pack that lets devices reuse each other's embeddings. It builds on add-embedded-graph-store. See `docs/adr/0002-plugin-bundles-code-downloads-only-model-weights.md` and `docs/adr/0003-per-device-graph-store-shared-vector-pack.md`.

## What Changes

- A candle-based WASM embedding runtime (`@typedgraph/embed`), built from lat.md's MIT engine for both the web and Node targets, running BERT-family models with mean or CLS pooling and per-model query and passage prefixes.
- Three local presets: `minilm-l6` (all-MiniLM-L6-v2, 384, English, default), `bge-small-en` (bge-small-en-v1.5, 384, English) and `e5-small-multi` (multilingual-e5-small, 384, about 100 languages); plus custom endpoint models through the existing Ollama and OpenAI-compatible providers.
- The CLI pre-bundles `minilm-l6` as an npm dependency, so `tg search` is hybrid with no configuration and no network. **BREAKING**: a bare `tg search` now embeds locally; `TG_EMBED_PROVIDER=none` or `--mode lexical` restores lexical-only.
- A model fingerprint: runtime, model id, weights sha256, dimension, pooling, normalization, prefix scheme, chunker version and text-template version, hashed to a short id and stored in `StoreMeta`.
- The stored fingerprint is authoritative: a different configured model never silently re-embeds; only `tg reindex [--model preset]` (CLI) or "Change model…" (plugin, add-plugin-search) switches, through a shadow build.
- Shadow build: the new store builds beside the current one, which keeps answering with its own model; the switch happens only on completion; probes the new model before starting; resumes after interruption.
- Vector pack: per-note, content-addressed files of float16 vectors under a fingerprint directory, written by any device and read before embedding.
- Phase 2 of store sync gets a real embedding queue: pack first, then the runtime in batches that yield, with progress.

## Capabilities

### New Capabilities
- `local-embedding`: the bundled runtime, presets, fingerprint, shadow build, model switching and the embedding queue.
- `vector-pack`: the content-addressed shared vector format, its location, reads, writes and pruning.

### Modified Capabilities
- `embedding-provider`: local default becomes the bundled runtime for the CLI and plugin; identity becomes the fingerprint; the plugin may embed.
- `tg-search`: hybrid by default with the bundled model; provider selection gains presets; lexical default only when disabled.

## Impact

- New package `packages/embed` (`@typedgraph/embed`): runtime, worker pool (Node `worker_threads`, browser Web Workers), manifests; and `@typedgraph/embed-minilm-l6` with weights (Apache-2.0) as a separate package.
- `packages/core`: fingerprint, `EmbeddingQueue` implementation, pack reader and writer over an injected file API.
- `packages/cli`: model config, `tg reindex --model`, `--yes`, progress on stderr, install size grows by about 50 MB.
- `packages/sidecar`: unchanged until converge-sidecar-vectors.
- Licenses: lat.md engine (MIT, attribution kept), MiniLM and bge-small (Apache-2.0 / MIT), multilingual-e5-small (MIT).
