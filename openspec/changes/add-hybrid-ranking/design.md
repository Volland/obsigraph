## Context

Building blocks exist: `chunkNote` (heading-aware chunks with a context prefix, deterministic ids), `verbalizeEdge` (edge to sentence), `LexicalIndex` (weighted BM25 in memory), `fuseRanks` (RRF, k = 60), and the sidecar's `retrieve` (vector seeds, breadth-first expansion with a per-node cap, chunk cap and 16,000-character budget, citations, `truncated`, untrusted-content marking). In Ladybug, vector and FTS indexes exist only on node tables, and a `QUERY_VECTOR_INDEX` result can feed a `MATCH` in the same query.

## Goals / Non-Goals

**Goals:**
- One pipeline and one output contract for CLI, plugin and sidecar.
- Exact identifiers still found (BM25), meaning found (vectors), and related results grouped (graph).
- Explainable ranking.

**Non-Goals:**
- LLM query rewriting or answer generation.
- Cross-encoder re-ranking.
- Personalization or click feedback.

## Decisions

**1. Schema additions.** On `Node`: `card_text STRING`, `card_hash STRING`, `card_emb FLOAT[d]`. New node tables `Chunk(id, node_id, ordinal, heading_path, text, text_hash, start_line, end_line, emb FLOAT[d])` and `Fact(id, edge_id, type, sign, sentence, text_hash, source_id, target_id, emb FLOAT[d])`, relationship tables `HAS_CHUNK(Node→Chunk)` and `ABOUT(Fact→Node, role)`. One vector index and one FTS index per unit table. `d` comes from the store's fingerprint; with vectors disabled the vector columns and indexes are omitted.

**2. Text templates (versioned by `TEXT_TEMPLATE_VERSION`).**
- Card: `{title}\nType: {labels}\n{key: value for up to 8 scalar properties}\n{leading paragraph}\n{up to 8 outgoing typed edges as verbalized sentences}`, capped at the model's token limit.
- Chunk: `chunkNote` output, prefix `{title} › {heading path}`.
- Fact: `verbalizeEdge` sentence; only for edges with a type other than `contains`, `references` and plain link edges.
- Lattice: Card is `{heading path}\n{leading paragraph}`; Chunks split the section's own body; Facts come from `@tg:` annotations and OpenSpec trace edges.

**3. Pipeline.**
1. Gather: for each unit with vectors, `QUERY_VECTOR_INDEX` top 50; for each unit, `QUERY_FTS_INDEX` top 50; `--type` and `--target` filters applied in the query.
2. Lift: Chunk to its node; Fact to both endpoints, keeping the Fact as evidence.
3. Fuse: weighted RRF, `score(n) = Σ w_list / (60 + rank)`, weights Card 1.0, Chunk 1.0, Fact 0.6 for both vector and BM25 lists; a node takes its best rank per list.
4. Graph boost: for the top 20 fused nodes, `boost(n) = 0.15 × Σ score(m)` over other top-20 nodes `m` directly linked to `n` (any edge direction, typed or untyped), capped at 50% of `score(n)`; one pass, no iteration.
5. Group: one result per node with its best Chunk (heading path, lines, snippet) and up to 3 matching Facts.

Weights and the boost factor are constants in `core`, tuned by the evaluation task, not user settings.

**4. Modes.** `hybrid` uses all lists; `lexical` only BM25 lists and works with vectors disabled; `semantic` only vector lists. When no vectors exist yet for some units, they appear only through BM25, and the result reports how many units are waiting.

**5. Explain.** `--explain` (and the plugin's "why?") shows per result each list's rank, the fused score, the boost and the nodes that caused it.

**6. Retrieve.** `retrieve` runs the pipeline's gather and lift steps for seeds, then the sidecar's expansion and budget logic over the store with Cypher, returning the existing contract (cited chunks with path, heading, score, role and distance; hit and connecting edges; `truncated`; untrusted-content notice). It moves into `core` so the CLI, plugin and sidecar share it.

**7. `--then`.** Runs a read-only Cypher query on the store with `$hits` bound to the result node ids, as the sidecar's `then` does; the JSON output carries both.

## Risks / Trade-offs

- [Cards add about 10 to 20% embedding work] → Accepted; they are the main relevance gain for entity questions.
- [Graph boost can promote hubs] → Only top-20 neighbors count, the boost is capped at half the base score, and `--no-boost` and `--explain` exist.
- [Six queries per search] → Each is an index lookup; measured target under 150 ms for 30k units in WASM.
- [Fact noise from generic edge types] → Structural and untyped links are excluded; schema-typed edges remain.

## Migration Plan

New tables are added by a schema format bump, which rebuilds stores once (derived data). `--lexical` stays as an alias.

## Open Questions

- Whether Card text should include incoming edges for nodes with no outgoing ones (decided by the evaluation in tasks).
