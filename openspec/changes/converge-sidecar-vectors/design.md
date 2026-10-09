## Context

`VectorIndex` (`packages/sidecar/src/vectors/vector-index.mts`) stores per-note JSON vector files, re-embeds only changed text, keeps pending notes while the provider is down, and records model identity, refusing mixed vectors until `POST /vectors/rebuild`, which discards everything and re-embeds. `Ops` answers search and retrieve and flags `stale` results on equal-dimension mismatches. The mirror already runs native Ladybug in the same process.

## Goals / Non-Goals

**Goals:**
- One layout, pipeline and model identity across plugin, CLI and sidecar.
- Keep the REST and MCP surface backward compatible where it costs little.

**Non-Goals:**
- Changing authentication, binding or limits.
- Write tools over MCP (Phase 1 of the roadmap handles that separately).

## Decisions

**1. Vectors live in the mirror.** The mirror's store gets the Card, Chunk and Fact tables from the shared schema; the sidecar's embedding queue writes vectors there. The "vectors stay out of Ladybug" rationale is withdrawn: the native image pre-installs the `vector` and `fts` extensions at build time, so no network install happens at runtime.

**2. Runtime in the sidecar.** The default preset runs in the shared WASM runtime with a `worker_threads` pool sized to the container's CPUs. Ollama and OpenAI-compatible providers remain as custom models and are the better choice for large vaults on a GPU host.

**3. Compatibility.** `target: edges` maps to `facts`; `mode: best` maps to the pipeline with only Chunk lists, `mode: pooled` to Card lists, both with a deprecation notice in the response; responses keep their existing fields and add `fingerprint`, `waiting` and per-hit `facts`. `POST /vectors/rebuild` now runs a shadow build for the configured model instead of discarding first; `POST /vectors/switch {model}` does the same for a named preset.

**4. Degraded states.** Provider unreachable: structural sync continues; lexical lists still answer; semantic and hybrid answer with lexical results and `degraded: true` instead of 503, which is a behavior change that keeps agents productive. `OBSIGRAPH_VECTORS=0` still disables vectors and makes semantic mode answer 503; lexical mode works.

**5. Migration.** On first start, if `vectors/` exists, the sidecar starts a shadow build in the mirror for the configured model, answering from the old JSON index until it completes, then deletes `vectors/`.

## Risks / Trade-offs

- [Default model change surprises existing users] → Explicit `OBSIGRAPH_EMBED_PROVIDER=ollama` keeps nomic; changelog and startup log name the new default; baseline shows no outside issues.
- [Image size grows by about 50 MB] → Acceptable for a server image; a `-slim` tag without weights for custom-model users.
- [503 to degraded change] → Clients that relied on 503 see `degraded: true`; documented.

## Migration Plan

Shadow build from JSON vectors into the mirror on first start; delete `vectors/` after completion. Rollback: the previous image rebuilds JSON vectors from markdown.
