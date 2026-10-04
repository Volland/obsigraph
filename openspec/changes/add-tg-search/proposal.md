## Why

`lat search` needs an OpenAI or Vercel key, so a hook that runs it fails on a fresh clone. Agents must be able to search docs with no setup.

## What Changes

- `tg search` ranks sections lexically (BM25 over title, leading paragraph, body) with no key and no network.
- When an embedding provider is configured (Ollama or an OpenAI-compatible endpoint) it switches to hybrid lexical plus vector ranking, reusing the existing `core` embedding provider and verbalizer.
- `LAT_LLM_KEY`, `LAT_LLM_KEY_FILE` and `LAT_LLM_KEY_HELPER` are accepted as aliases of the tg variables.
- `tg reindex` rebuilds the derived cache in `.tg/`, which is gitignored.
- Decision: lexical by default, embeddings opt-in.
- Assumption: docs folders are small enough (hundreds of sections) for an in-memory index rebuilt in milliseconds.

## Capabilities

### New Capabilities
- `tg-search`: Lexical and hybrid section search, cache, and key handling.

### Modified Capabilities

## Impact

- New `packages/core/src/latmd/search.ts` and CLI commands. Reuses `embedding-provider` and `chunking-verbalization`. No sidecar dependency.
