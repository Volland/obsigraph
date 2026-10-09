## Context

Building blocks exist: `chunkNote` (heading-aware chunks with a context prefix, deterministic ids), `verbalizeEdge` (edge to sentence), `LexicalIndex` (weighted BM25 in memory), `fuseRanks` (RRF, k = 60), and the sidecar's `retrieve` (vector seeds, breadth-first expansion with a per-node cap, chunk cap and 16,000-character budget, citations, `truncated`, untrusted-content marking). In Ladybug, vector and FTS indexes exist only on node tables, and a `QUERY_VECTOR_INDEX` result can feed a `MATCH` in the same query.

The baseline to beat is lat.md 0.13 (`lat.md-code/src/search/`), which is already hybrid on the same kind of corpus: one full-text list over token-budgeted chunks (stemmed, heading weight 2.0, body 1.0, path 0.5), an exact-identifier table whose hits sort first in that list, one cosine list with a 0.2 similarity floor, plain two-list RRF (k = 60), and candidate fetching that grows until it holds 50 distinct sections. Any extra list or boost here must show a gain over that on our evaluation set, or it stays off.

## Goals / Non-Goals

**Goals:**
- One pipeline and one output contract for CLI, plugin and sidecar.
- Exact identifiers always found first, meaning found (vectors), related results grouped (graph).
- Explainable ranking.
- A pipeline that can be evaluated before the graph store lands.

**Non-Goals:**
- LLM query rewriting or answer generation.
- Cross-encoder re-ranking.
- Personalization or click feedback.

## Decisions

**1. Schema additions.** On `Node`: `card_text STRING`, `card_hash STRING`, `card_emb FLOAT[d]`. New node tables `Chunk(id, node_id, ordinal, heading_path, text, text_hash, start_line, end_line, idents STRING[], emb FLOAT[d])` and `Fact(id, edge_id, type, sign, sentence, text_hash, source_id, target_id, emb FLOAT[d])`, relationship tables `HAS_CHUNK(Node→Chunk)` and `ABOUT(Fact→Node, role)`. One FTS index on `Chunk` (text, heading path, title) and one on `Fact`. No vector index by default (decision 8). `d` comes from the store's fingerprint; with vectors disabled the vector columns are omitted.

**2. Text templates (versioned by `TEXT_TEMPLATE_VERSION`).**
- Card: `{title}\nType: {labels}\n{key: value for up to 8 scalar properties}\n{leading paragraph}\n{up to 8 outgoing typed edges as verbalized sentences}`, cut to the model's token limit.
- Chunk: `chunkNote` output, prefix `{title} › {heading path}`, sized in model tokens (decision 3).
- Fact: `verbalizeEdge` sentence; only for edges with a type other than `contains`, `references` and plain link edges.
- Lattice: no Card (a section's heading path and leading paragraph are already its first Chunk, so a Card would only count the same text twice); Chunks split the section's own body; Facts come from `@tg:` annotations and OpenSpec trace edges.

**3. Token-sized chunks.** `chunkNote` takes a token budget and the model's tokenizer count function instead of a character limit: target 192 tokens for local presets (all have a 256 or 512 limit; MiniLM truncates at 256), 512 for remote models, with the context prefix counted in the budget. The previous 1,500-character default is about 350 to 400 tokens, so MiniLM never saw the tail of a full chunk. The budget is part of `CHUNKER_VERSION` and so of the fingerprint. Without a tokenizer (lexical-only stores) chunks fall back to 800 characters.

**4. Identifiers.** At sync, each Chunk stores `idents`: the lowercased tokens of its text, heading path, node id and file path that contain one of `_ . / : # @ -`, are camelCase or PascalCase with an inner capital, or are at least 40 characters long (lat.md's rule plus camelCase, since TypeScript symbols such as `diffMirror` are the most common lookup in code-adjacent docs).

**5. Lists.** The pipeline consumes ranked lists from a `ListSource` interface (`exact`, `text(unit)`, `vector(unit)`), so it runs over the graph store and, before that lands, over today's in-memory `LexicalIndex` and flat vectors.
- `exact`: Chunks whose `idents` contain the whole trimmed, lowercased query, when the query is a single identifier token.
- `chunk-text`: BM25 over Chunks.
- `chunk-vec`: cosine over Chunk vectors.
- `card-vec`: cosine over Card vectors (vault only).
- `fact-text` and `fact-vec`: BM25 and cosine over Facts, only when the corpus has Facts.

There is no BM25 list over Cards: a Card's title and leading paragraph are already in its Chunks' text and prefix, and a correlated second list would count them twice. Each list fetches candidates until it holds 50 distinct nodes or 500 units, whichever comes first, so a few long notes cannot fill it. Vector lists drop hits below a cosine floor, 0.2 by default and set per preset by the evaluation; a query whose vector lists are all empty after the floor returns lexical hits only, and an empty result when those are empty too.

**6. Pipeline.**
1. Gather the lists above; `--type` and `--target` filters applied in each list.
2. Lift: Chunk to its node; Fact to its source node with full weight and to its target node with half weight, keeping the Fact as evidence for both.
3. Fuse: weighted RRF, `score(n) = Σ w_list × lift / (60 + rank)`, a node taking its best rank per list. Starting weights: `chunk-text` 1.0, `chunk-vec` 1.0, `card-vec` 0.7, `fact-text` 0.4, `fact-vec` 0.4.
4. Graph boost (decision 7).
5. Tier: nodes with an `exact` hit rank above all others, ordered among themselves by their boosted score; the rest follow by boosted score.
6. Group: one result per node with its best Chunk (heading path, lines, snippet) and up to 3 matching Facts.

Weights, floor and boost are constants in `core`, tuned by the evaluation task, not user settings.

**7. Graph boost.** For the top 20 fused nodes, `boost(n) = β × Σ score(m) / sqrt(deg(m))` over other top-20 nodes `m` joined to `n` by a typed edge, where `deg(m)` counts `m`'s typed edges, capped at `0.25 × (score(rank 1) − score(rank 20))`; one pass, no iteration. Untyped edges (`contains`, `references`, plain links) never boost, so a Lattice parent and its children do not promote each other. The cap is tied to the spread of the top 20 rather than to a node's own score, because RRF scores are compressed (rank 1 is about 1.3 times rank 20) and a cap of half a node's score would let the boost decide the whole order. `β` starts at 0.15. The boost is on by default only if the evaluation shows it raises MRR@10 on the held-out queries; otherwise `--boost` turns it on and `--no-boost` stays accepted.

**8. Exact vector scan.** Vector lists compute cosine over every unit's vector in the store (`array_cosine_similarity`, or a typed-array scan in the `ListSource` before the store lands) instead of querying an HNSW index. At the target scale (under 50,000 units) an exact scan is fast enough, as lat.md and the sidecar show, and it avoids approximate misses, filtered queries that return fewer than k hits, and index maintenance when Phase 2 fills vectors left empty by Phase 1. An HNSW index is created only above `TG_ANN_THRESHOLD` units (default 50,000), and only after the store spike confirms that Ladybug's vector index accepts updates to an indexed column.

**9. Modes.** `hybrid` uses all lists; `lexical` only `exact` and BM25 lists and works with vectors disabled; `semantic` only vector lists (plus `exact`). When no vectors exist yet for some units, they appear only through BM25, and the result reports how many units are waiting.

**10. Explain.** `--explain` (and the plugin's "why?") shows per result its tier, each list's rank and similarity, the fused score, the boost and the nodes that caused it.

**11. Retrieve.** `retrieve` runs the pipeline's gather and lift steps for seeds, then the sidecar's expansion and budget logic over the store with Cypher, returning the existing contract (cited chunks with path, heading, score, role and distance; hit and connecting edges; `truncated`; untrusted-content notice). It moves into `core` so the CLI, plugin and sidecar share it.

**12. `--then`.** Runs a read-only Cypher query on the store with `$hits` bound to the result node ids, as the sidecar's `then` does; the JSON output carries both.

**13. Evaluation.** The query set and script from improve-tg-search-ranking, extended to about 80 queries over this repository's lat.md and the example vault, labeled with relevant nodes, in four kinds: identifier, keyword, meaning-only (no shared words) and relationship. Half tune the constants, half are held out and reported. Metrics: MRR@10 and nDCG@10 for search, recall@20 of seed nodes for retrieve. Baselines: current `tg search`, lat.md 0.13 `lat search` on the same lat.md, and the new pipeline with each of Cards, Facts and the boost switched off in turn. A component that does not improve the held-out score is disabled by default.

## Risks / Trade-offs

- [Cards add about 10 to 20% embedding work in vaults] → Accepted if the evaluation shows a gain on entity questions; Lattice corpora skip them.
- [Graph boost can promote hubs] → Typed edges only, degree normalization, a cap tied to the top-20 spread, default-on only with a measured gain, and `--explain`.
- [Exact scan cost grows linearly] → About 30,000 384-dimension vectors scan in a few milliseconds; the ANN threshold covers larger corpora.
- [A cosine floor can hide weak but correct matches] → The floor is per preset and tuned on meaning-only queries; `--explain` shows the similarity of every vector hit.
- [Fact noise from generic edge types] → Structural and untyped links are excluded; schema-typed edges remain, at low weight.
- [The exact tier can surface a section that merely mentions an identifier above the one that defines it] → Ties within the tier are ordered by fused score, where heading and title weights favor the defining section.

## Migration Plan

New tables are added by a schema format bump, which rebuilds stores once (derived data). The token-sized chunker bumps `CHUNKER_VERSION`, which changes every fingerprint and re-embeds once. `--lexical` stays as an alias.

## Open Questions

- Whether a vault Card should include incoming edges for nodes with no outgoing ones (decided by the evaluation).
- The cosine floor for `bge-small-en` and `e5-small-multi`, whose similarity distributions sit higher than MiniLM's.
