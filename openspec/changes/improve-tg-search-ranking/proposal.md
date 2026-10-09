## Why

Agents using `tg` mostly search for symbols, file paths and requirement names, and `tg search` handles those worse than lat.md 0.13 does on the same `lat.md/` folder. In hybrid mode, a section that is the only one containing `diffMirror` can lose to a section that is merely close in two lists, because reciprocal rank fusion has no notion of an exact match. Vector search embeds each section as one text cut at 2,000 characters, so anything later in a long section is invisible to it. Every vector hit with a positive cosine enters the fusion, so a nonsense query still returns five confident-looking results. And nothing measures ranking, so none of this can be tuned or compared.

This is the first, small iteration of the search work planned in `lat.md/embedded-search.md`. It fixes these four problems inside today's in-memory `tg search`, with no new store, model or host, and builds the query set that later decides whether the larger pieces (graph store, bundled model, Cards, Facts, graph boost) are worth building.

## What Changes

- **Exact-identifier tier.** Sections whose id, file path, heading or body contain the query as an identifier-like token (containing `_ . / : # @ -`, camelCase or PascalCase with an inner capital, or at least 40 characters) rank above all other results in lexical and hybrid modes, and in the prompt hook.
- **Section chunks for vectors.** Each section is embedded as heading-prefixed chunks of at most 1,500 characters instead of one text cut at 2,000; a section's vector score is its best chunk. Unchanged chunks keep their cached vectors.
- **Similarity floor.** Vector hits below a cosine floor (0.2 by default, tunable per provider family and with `TG_SEARCH_MIN_SIMILARITY`) are dropped before fusion.
- **Rank details in JSON.** Each hit in `--json` output gains `tier` (`exact` or `fused`) and its rank in each list, so a ranking can be debugged and evaluated.
- **Ranking evaluation.** A labeled query set over this repository's `lat.md/` with a tuning half and a held-out half, and `npm run eval:search` reporting MRR@10, nDCG@10 and recall@5 for the previous and new ranking, and for lat.md's `lat search` when it is installed.
- A small `rankSections` function in `core` that applies tiers and fusion to ranked lists, which add-hybrid-ranking will extend rather than replace.

Out of scope: the graph store, a bundled local model, Cards, Facts, the graph boost, `tg retrieve`, `--explain` text output and anything in the plugin or sidecar.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tg-search`: exact-identifier tier, section chunks for vectors, similarity floor, rank details in JSON output and the ranking evaluation.

## Impact

- `packages/core/src/latmd/search.ts`: `identifierTokens`, per-section identifier sets, `sectionChunks`, `rankSections` (tiers plus RRF), a floor in `vectorRank` that collapses chunk hits to their best per section.
- `packages/cli/src/embed.mts`: `VectorCache` keyed by chunk text hash, with `CHUNKER_VERSION` in the cache label so a chunking change re-embeds once.
- `packages/cli/src/commands/search.mts` and `hook.mts`: use `rankSections`; JSON output fields.
- New `eval/search/` (queries, labels, script) and an `eval:search` npm script; not run in CI except for the lexical-only, network-free path.
- Existing `.tg/vectors.*` caches are re-embedded once after upgrade, because their keys change from section text to chunk text.
