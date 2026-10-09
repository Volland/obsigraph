## Why

`tg search` fuses two lists (BM25 over sections, cosine over whole sections cut at 2,000 characters) and knows nothing about the graph it sits on. lat.md 0.13 is a stronger baseline on the same kind of corpus: BM25 over token-budgeted chunks, an exact-identifier channel that puts literal symbol matches first, cosine with a similarity floor, and two-list RRF. The sidecar embeds chunks and edge sentences but scores a node by its best chunk or an average of its chunks, which smears long notes and ignores what a node is linked to. improve-tg-search-ranking closes the identifier, truncation and floor gaps inside today's in-memory search and adds the evaluation; this change builds on it. With a graph store holding graph, text and vectors together (add-embedded-graph-store) and a local model (add-local-embedding), search can match lat.md on identifiers and keywords, then rank by what a node is and which relationship matches, and lift results that belong together in the graph, keeping each of those additions only where an evaluation shows it helps.

## What Changes

- Three searchable units per corpus: **Card** (one per vault node: title, types, key properties, leading paragraph and main outgoing edges as sentences; none for Lattice sections, whose first Chunk already says the same), **Chunk** (heading-scoped pieces with a title and heading-path prefix, sized in model tokens) and **Fact** (a typed edge reified with its verbalized sentence and links to both endpoints). Untyped structural links never become Facts.
- One ranking pipeline in `core`, used by every host and fed by a list-source interface so it can be evaluated before the graph store lands: an exact-identifier tier, BM25 over Chunks and Facts, cosine over Chunks, Cards and Facts with a similarity floor, lifting to nodes (Facts weighted toward their source), weighted reciprocal rank fusion, a bounded graph boost over typed edges, and grouping into one result per node with its best Chunk and matching Facts.
- Exact cosine scans by default; an approximate vector index only above a size threshold.
- `tg search` gains `--mode hybrid|lexical|semantic`, `--target nodes|chunks|facts`, `--type`, `--explain`, `--boost`/`--no-boost` and `--then '<cypher>'`; `--lexical` stays as an alias of `--mode lexical`.
- New `tg retrieve <question>` returning a context pack with the sidecar's `retrieve` contract, and an MCP tool `tg_retrieve`.
- The node vector is the Card embedding (vaults) or the best Chunk (Lattice); the sidecar's `pooled` node score is superseded.
- A held-out evaluation against current `tg search` and lat.md decides the weights, the floor and whether Cards, Facts and the boost are on by default.

## Capabilities

### New Capabilities
- `hybrid-ranking`: searchable units, their text templates, identifiers, the pipeline, weights, floor, graph boost, grouping, explanations and evaluation.
- `tg-retrieve`: the `tg retrieve` command and `tg_retrieve` MCP tool producing a context pack.

### Modified Capabilities
- `tg-search`: new options and output fields.
- `chunking-verbalization`: chunks sized in model tokens; node scoring uses the Card and best Chunk, not pooled chunks.
- `tg-agent-integration`: `tg_retrieve` joins the MCP tools; the prompt hook still never opens the store.

## Impact

- `packages/core`: `search/units.ts` (Card, Chunk, Fact builders, identifiers and templates, versioned), `search/sources.ts` (list-source interface with in-memory and store implementations), `search/pipeline.ts`, `search/boost.ts`, token-budgeted `chunkNote`, schema additions (`Card` columns on `Node`, `Chunk`, `Fact`, `HAS_CHUNK`, `ABOUT`), retrieve moved or adapted from `packages/sidecar/src/rag/retrieve.mts` to run on any `GraphStore`.
- `packages/cli`: `search` flags and output, new `retrieve` command, MCP tool, an evaluation script.
- Lattice corpus: a section is a node with Chunks and no Card; Facts are `@tg:` and trace edges.
