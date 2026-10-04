## 1. Lexical

- [ ] 1.1 Tokenize and index sections (title, leading paragraph, body) with BM25
- [ ] 1.2 Implement `tg search` text and `--json` output with limits

## 2. Hybrid

- [ ] 2.1 Reuse the embedding provider and verbalizer to embed sections
- [ ] 2.2 Fuse rankings with reciprocal rank fusion
- [ ] 2.3 Degrade to lexical when the provider fails

## 3. Cache and keys

- [ ] 3.1 Implement `.tg/` cache keyed by section hash and `tg reindex`
- [ ] 3.2 Honor `TG_*` and `LAT_LLM_KEY*` variables without persisting keys

## 4. Tests

- [ ] 4.1 Write tests covering every scenario in the tg-search spec

## 5. Sync

- [ ] 5.1 Document in lat.md/cli, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
