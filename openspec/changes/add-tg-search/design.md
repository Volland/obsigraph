## Context

The vector stack lives in the sidecar and Ladybug. The CLI must stay standalone, so semantic search here uses a plain on-disk vector file, not a database.

## Goals / Non-Goals

**Goals:** works offline with zero config; optional semantic recall; fast cold start; derived cache only.

**Non-Goals:** talking to the sidecar, multi-project indexes, query-time reranking models.

## Decisions

**BM25 in memory, rebuilt per call** when the cache is stale (mtime and hash), because for docs-sized corpora it is faster than loading state.

**Hybrid uses reciprocal rank fusion** of lexical and vector ranks, avoiding score calibration between the two.

**Embeddings stored as a flat float file keyed by section hash** in `.tg/`; stale entries are dropped on reindex.

**Key variables:** `TG_*` take precedence, `LAT_LLM_*` are honored as aliases, and no key is ever written to disk.

## Risks / Trade-offs

- [Lexical misses paraphrases] -> clearly documented; embeddings are one setting away.
- [Embedding provider outage in a hook] -> hybrid degrades to lexical with a note, never fails.
