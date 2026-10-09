## Why

`tg search` fuses two lists (BM25 over sections, cosine over whole sections cut at 2,000 characters) and knows nothing about the graph it sits on. lat.md is vectors only. The sidecar embeds chunks and edge sentences but scores a node by its best chunk or an average of its chunks, which smears long notes and ignores what a node is linked to. With a graph store holding graph, text and vectors together (add-embedded-graph-store) and a local model (add-local-embedding), search can rank by what a node is, where something is said, and which relationship matches, and lift results that belong together in the graph.

## What Changes

- Three searchable units per corpus, each a node table with a vector index and a full-text index: **Card** (one per node: title, types, key properties, leading paragraph and main outgoing edges as sentences), **Chunk** (heading-scoped pieces with a title and heading-path prefix) and **Fact** (a typed edge reified with its verbalized sentence and links to both endpoints). Untyped structural links never become Facts.
- One ranking pipeline in `core`, used by every host: gather up to six lists (vector and BM25 over Card, Chunk and Fact), lift to nodes, fuse with weighted reciprocal rank fusion, apply the graph boost, group into one result per node with its best Chunk and matching Facts.
- `tg search` gains `--mode hybrid|lexical|semantic`, `--target nodes|chunks|facts`, `--type`, `--explain`, `--no-boost` and `--then '<cypher>'`; `--lexical` stays as an alias of `--mode lexical`.
- New `tg retrieve <question>` returning a context pack with the sidecar's `retrieve` contract, and an MCP tool `tg_retrieve`.
- The node vector is the Card embedding; the sidecar's `pooled` node score is superseded.

## Capabilities

### New Capabilities
- `hybrid-ranking`: searchable units, their text templates, the pipeline, weights, graph boost, grouping and explanations.
- `tg-retrieve`: the `tg retrieve` command and `tg_retrieve` MCP tool producing a context pack.

### Modified Capabilities
- `tg-search`: new options and output fields.
- `chunking-verbalization`: node scoring uses the Card, not pooled chunks.
- `tg-agent-integration`: `tg_retrieve` joins the MCP tools; the prompt hook still never opens the store.

## Impact

- `packages/core`: `search/units.ts` (Card, Chunk, Fact builders and templates, versioned), `search/pipeline.ts`, `search/boost.ts`, schema additions (`Card` columns on `Node`, `Chunk`, `Fact`, `HAS_CHUNK`, `ABOUT`), retrieve moved or adapted from `packages/sidecar/src/rag/retrieve.mts` to run on any `GraphStore`.
- `packages/cli`: `search` flags and output, new `retrieve` command, MCP tool.
- Lattice corpus: a section is a node; its Card is heading path plus leading paragraph; Facts are `@tg:` and trace edges.
