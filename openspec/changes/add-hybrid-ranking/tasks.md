## 1. Units

- [ ] 1.1 Schema additions: Card columns on `Node`, `Chunk`, `Fact`, `HAS_CHUNK`, `ABOUT`, vector and FTS indexes; bump the store format version
- [ ] 1.2 Card, Chunk and Fact builders with versioned text templates for vault and Lattice corpora
- [ ] 1.3 Write units in sync Phase 1 and queue their vectors for Phase 2

## 2. Pipeline

- [ ] 2.1 Gather, lift, weighted RRF, graph boost and grouping in `core`
- [ ] 2.2 Modes, `--type`, `--target`, waiting-unit counts, explanations
- [ ] 2.3 `--then` with `$hits` on the store, read-only

## 3. Retrieve

- [ ] 3.1 Move retrieve's expansion and budget logic from the sidecar into `core` over `GraphStore`
- [ ] 3.2 `tg retrieve` command and `tg_retrieve` MCP tool

## 4. CLI surface

- [ ] 4.1 `tg search` flags, text and JSON output, `--lexical` alias
- [ ] 4.2 Update `tg gen` skill text (`tg-docs`, `tg-graph`) to mention `tg retrieve` and `--explain`

## 5. Tests

- [ ] 5.1 Write tests covering every scenario in the hybrid-ranking, tg-retrieve and modified specs
- [ ] 5.2 Ranking fixtures: identifier query, meaning-only query, cluster boost, hub suppression

## 6. Evaluation and docs

- [ ] 6.1 Build a 40-query relevance set over this repository's lat.md and the example vault; record MRR@10 for lexical, current hybrid and the new pipeline; tune weights and boost
- [ ] 6.2 Update `lat.md/cli.md#Search`, `lat.md/vector-search.md` and `lat.md/embedded-search.md`; test-spec sections with `@lat:` refs; `tg check`
