## 1. Evaluation first

- [ ] 1.1 Extend the query set from improve-tg-search-ranking to about 80 queries, adding relationship queries and queries over the example vault
- [ ] 1.2 Extend its evaluation script with retrieve recall@20 and the pipeline configurations (Cards, Facts and the boost each removed)

## 2. Units

- [ ] 2.1 Token-budgeted `chunkNote` with the model's token counter; bump `CHUNKER_VERSION`
- [ ] 2.2 Card (vault only), Chunk and Fact builders with versioned text templates; identifier extraction per Chunk
- [ ] 2.3 Schema additions: Card columns on `Node`, `Chunk` (with `idents`), `Fact`, `HAS_CHUNK`, `ABOUT`, FTS indexes on `Chunk` and `Fact`; bump the store format version
- [ ] 2.4 Write units in sync Phase 1 and queue their vectors for Phase 2

## 3. Pipeline

- [ ] 3.1 `ListSource` interface with an in-memory implementation (today's `LexicalIndex` and flat vectors) and a graph-store implementation (BM25 via FTS, exact cosine scan, identifier lookup)
- [ ] 3.2 Distinct-node candidate fetching, similarity floor, role-weighted lifting, weighted RRF, exact tier and grouping in `core`
- [ ] 3.3 Graph boost over typed edges with degree normalization and the spread cap
- [ ] 3.4 Run the evaluation on the in-memory source; tune weights, floors and `β` on the tuning half; set the defaults of Cards, Facts and the boost from the held-out half
- [ ] 3.5 Modes, `--type`, `--target`, waiting-unit counts, explanations
- [ ] 3.6 `--then` with `$hits` on the store, read-only
- [ ] 3.7 Approximate vector index above `TG_ANN_THRESHOLD`, only if the store spike confirms index updates work

## 4. Retrieve

- [ ] 4.1 Move retrieve's expansion and budget logic from the sidecar into `core` over `GraphStore`
- [ ] 4.2 `tg retrieve` command and `tg_retrieve` MCP tool

## 5. CLI surface

- [ ] 5.1 `tg search` flags, text and JSON output, `--lexical` alias
- [ ] 5.2 Update `tg gen` skill text (`tg-docs`, `tg-graph`) to mention `tg retrieve` and `--explain`

## 6. Tests

- [ ] 6.1 Write tests covering every scenario in the hybrid-ranking, tg-retrieve and modified specs
- [ ] 6.2 Ranking fixtures: identifier query against multi-list matches, meaning-only query, nonsense query, cluster boost, hub bound, parent and child without boost, long-note crowding, Fact source versus target, in-memory and store sources agreeing

## 7. Docs

- [ ] 7.1 Record the evaluation results and chosen defaults in `lat.md/embedded-search.md`
- [ ] 7.2 Update `lat.md/cli.md#Search`, `lat.md/vector-search.md` and `lat.md/embedded-search.md`; test-spec sections with `@lat:` refs; `tg check`
