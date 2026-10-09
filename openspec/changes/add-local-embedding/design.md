## Context

lat.md 0.12.2 embeds with `@lat.md/embed` 0.2.0: a candle engine compiled to a 4 MB wasm-bindgen module (Node target), driven by a manifest (`id`, `dimensions`, `maxTokens`, `pooling`, `normalize`, weight, tokenizer and config paths). Weights ship as `@lat.md/embed-minilm-fp16` (45 MB fp16 safetensors, up-cast to fp32 at load, about 90 MB in memory). Jobs of 24 texts or more fan out over `worker_threads` with at least 8 texts per worker; smaller jobs run inline, one text per forward pass. The model record `local:minilm-l6-v2:384` is authoritative; `lat reindex` probes a remote key before dropping anything and records the model only after a successful build.

The bundled MiniLM vocabulary is `bert-base-uncased` (30,522 tokens), so it is English-only: Cyrillic and other scripts tokenize to near-characters and their vectors carry little meaning. The project owner's vaults are mixed with English preferred.

## Goals / Non-Goals

**Goals:**
- Offline hybrid search with no setup in the CLI; an opt-in, downloaded model in the plugin.
- Never mix vectors of different models, and never leave the user without search during a model change.
- Phones reuse vectors computed on other devices.

**Non-Goals:**
- Training or fine-tuning, quantization beyond fp16 (int8 is a later option for `e5-small-multi`).
- GPU or WebGPU acceleration.
- Re-ranking with a cross-encoder.

## Decisions

**1. Runtime.** Build `@typedgraph/embed` from lat.md's candle engine source (MIT, attribution in `NOTICE`), producing a web target for the plugin and a Node target for the CLI and sidecar, behind one `Embedder` interface: `{fingerprint, dimensions, maxTokens, countTokens(text), embed(texts, kind: 'query' | 'passage', onProgress)}`; the chunker uses `countTokens` to size chunks within `maxTokens` (add-hybrid-ranking). Alternative: transformers.js with onnxruntime-web; rejected because its runtime is several times larger and would ship inside `main.js`. Alternative: depend on `@lat.md/embed` directly; rejected for the plugin because its loader needs `fs` and `worker_threads`, but the CLI may use it until our build exists.

**2. Presets.**

| id | model | dim | pooling | prefixes | weights (fp16) | languages |
| --- | --- | --- | --- | --- | --- | --- |
| `minilm-l6` | sentence-transformers/all-MiniLM-L6-v2 | 384 | mean, normalized | none | 45 MB | English |
| `bge-small-en` | BAAI/bge-small-en-v1.5 | 384 | CLS, normalized | query: "Represent this sentence for searching relevant passages: " | ~65 MB | English |
| `e5-small-multi` | intfloat/multilingual-e5-small | 384 | mean, normalized | "query: " / "passage: " | ~235 MB | ~100 |

Custom models: `ollama/<model>` and `openai/<model>` through the existing providers, desktop and CLI only.

**3. Fingerprint.** `fingerprint = stableId(json({runtime, model, weightsSha256, dim, pooling, normalize, prefixQuery, prefixPassage, chunker: CHUNKER_VERSION, template: TEXT_TEMPLATE_VERSION}))`, shown as `minilm-l6@3f9a1c`. For remote models `weightsSha256` is replaced by the provider's model string, which is the best identity available. Any change to chunking or to the Card, Chunk or Fact text templates bumps a version and so the fingerprint.

**4. Authority.** The store's recorded fingerprint governs search. A configured model that differs from it does not change search; the CLI prints `index built with X; run tg reindex --model Y to switch`. A fresh store (none recorded) uses the configured model, else the default preset. This is lat.md's rule, kept because silent switching costs minutes of local CPU.

**5. Shadow build.** Switching creates a second store (`.tg/graph.<fp>.lbug`, or a second IDBFS path), syncs Phase 1 into it, then runs Phase 2 with the new model. The current store keeps answering with its own model and weights. On completion, `StoreMeta.state` becomes `complete`, the active pointer (`.tg/active` or a plugin setting) flips, and the old store is deleted. Before starting, the new model embeds one probe text; a failure (missing weights, rejected key) aborts with the current store untouched. An interrupted shadow build resumes from its own store on next run.

**6. Embedding queue.** Phase 2 lists units whose text hash has no vector, looks each up in the vector pack, and embeds the rest in batches of 16, yielding between batches; Node hosts use a worker pool above 24 texts as lat.md does; the plugin uses one dedicated embedding Worker (separate from the store Worker) so a long batch never delays a query. Vectors are written to the store and the pack together.

**7. Vector pack format.** Location: plugin `.obsidian/plugins/typed-graph/vectors/<fingerprint>/`; CLI only when `TG_VECTOR_PACK=<dir>` is set. One file per note version: name `<sha256(fingerprint + sorted unit text hashes)>.tgv`, under a two-character prefix directory. Content: a small header (magic `TGV1`, fingerprint, dimension, unit count) and per unit its text hash and float16 vector. Same note text and model give the same name on every device. Readers ignore files whose names do not match the pattern, which covers sync tools' conflict copies, and verify the header fingerprint. Pruning deletes files no current note references, at most once a day and only for the active fingerprint; directories of inactive fingerprints are deleted a week after a switch.

**8. CLI configuration.** `TG_EMBED_MODEL` takes a preset id or `ollama/<m>` or `openai/<m>`; `TG_EMBED_PROVIDER=none` disables vectors. Existing `TG_EMBED_PROVIDER=ollama|openai` and key variables keep working and map to custom models.

## Risks / Trade-offs

- [CLI install grows by about 50 MB] → Weights live in a separate package that `@typedgraph/cli` depends on; `TG_EMBED_PROVIDER=none` users still download it. Accepted, as lat.md does.
- [WASM floats may differ across engines, so two devices may write different bytes for one pack file] → Same-named files with different bytes only cause a sync conflict copy, which readers ignore and pruning removes; correctness does not depend on byte equality.
- [Per-note pack files: thousands of small synced files] → One file per note, not per unit; about 2 KB to 20 KB each.
- [e5-small-multi is heavy on phones] → The plugin's first run states size and expected time and allows "semantic search off on this device".
- [Default change makes bare `tg search` slower the first time] → First build prints progress; later runs embed only changed sections; hooks stay lexical.

## Migration Plan

Existing CLI users with `TG_EMBED_PROVIDER` set keep their provider as a custom model; their old vector files were already removed by add-embedded-graph-store, so their first run re-embeds. Users with nothing set move from lexical to hybrid automatically.

## Open Questions

- Whether `bge-small-en` should replace `minilm-l6` as the default after an evaluation on this repository's lat.md and the example vault (task 6.2).
