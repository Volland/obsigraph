## Context

Chunks and edge sentences are the units that get embedded and later cited. Both are pure functions of the graph model, so they live in `core` and run identically in plugin and sidecar. Motivation: lat.md/vector-search.

## Goals / Non-Goals

**Goals:** deterministic, self-contained chunks; edges searchable by meaning; stable identifiers for incremental indexing.

**Non-Goals:** calling the embedding provider, storing anything, tokenizer-exact sizing, semantic chunking by model.

## Decisions

**Split by heading, then by size on paragraph then sentence then word boundaries.** Alternative, fixed-size sliding windows, loses the heading anchor needed for citations. Character-based limit avoids a tokenizer dependency; default about 1500 characters.

**Prepend context to the text that is embedded, not to the stored body.** Citations return the original body while the vector reflects title, type and frontmatter. Alternative, embedding only the body, was rejected because short chunks lose their subject.

**Chunk id is a hash of note path, heading path, ordinal and text.** This lets the index skip unchanged chunks per file and delete stale ones. Alternative, ordinal only, would re-embed every following chunk after an insertion.

**Node score defaults to best chunk.** It preserves precise hits; pooling is available for broad topical queries. The aggregation is a function over chunk similarities so the index can apply it.

**Verb from the edge type name, sign shown as `(negative)`.** Keeps the sentence natural for the embedding model while separating polarity from the text of the type. Alternative, prefixing `not`, was rejected as ungrammatical for arbitrary type names.

**Assumption:** properties other than `label` render as `key value`; values are truncated to a sane length.

## Risks / Trade-offs

- [Large frontmatter inflates every chunk] -> cap prepended frontmatter length and drop the longest values first.
- [Character limits vs model context] -> default is well within `nomic-embed-text` context; configurable.
- [Verbalization wording affects retrieval quality] -> isolated in one function so it can be tuned without touching the index.
