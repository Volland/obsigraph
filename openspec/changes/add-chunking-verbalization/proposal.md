## Why

Embeddings need prose. Notes must be split into chunks that carry their own context, and edges, which have no prose, must be rendered as sentences. See lat.md/vector-search#Node chunks and lat.md/vector-search#Edge verbalization.

## What Changes

- Add a note chunker in `packages/core` that splits a note by headings and size and prepends title, type labels and frontmatter to every chunk.
- Record for each chunk its note path and heading so results can be cited.
- Add a node score aggregation: best chunk by default, pooled vector as an option.
- Add an edge verbalizer that renders `Source (Type) type Target (Type) - props` sentences.

## Capabilities

### New Capabilities
- `chunking-verbalization`: Deterministic chunking of notes and sentence rendering of edges for embedding.

### Modified Capabilities

## Impact

- New pure modules in `packages/core`, no I/O and no dependency on the provider. Depends on `graph-model` for node types and edges and on `edge-parsing` for headings.
- Assumptions: size limit is counted in characters with a default of about 1500 and a small overlap; the prepended context is not counted against overlap. The verbalizer uses the edge type name as the verb, with underscores and hyphens turned into spaces. Properties are rendered as `key value` pairs, with a string property named `label` rendered as its bare value.
