## 1. Lexical

- [x] 1.1 Tokenize and index sections (title, leading paragraph, body) with BM25
- [x] 1.2 Implement `tg search` text and `--json` output with limits

## 2. Hybrid

- [x] 2.1 Reuse the sidecar's embedding provider classes to embed sections (edge verbalization is not used: documents are sections, not edges)
- [x] 2.2 Fuse rankings with reciprocal rank fusion
- [x] 2.3 Degrade to lexical when the provider fails

## 3. Cache and keys

- [x] 3.1 Implement `.tg/` cache keyed by section hash and `tg reindex`
- [x] 3.2 Honor `TG_*` and `LAT_LLM_KEY*` variables without persisting keys

## 4. Tests

- [x] 4.1 Write tests covering every scenario in the tg-search spec

## 5. Sync

- [x] 5.1 Document in lat.md/cli, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
