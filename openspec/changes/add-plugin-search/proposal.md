## Why

The Obsidian plugin has no search at all (its only command opens the graph view), and its documents say it never embeds. Obsidian users, on mobile especially, cannot ask their typed graph a question by meaning, and nothing tells them which model understands their notes. With the graph store, the local runtime and the ranking pipeline in place (add-embedded-graph-store, add-local-embedding, add-hybrid-ranking), the plugin can offer the same search as `tg`, offline, on desktop and mobile, and make the embedding model visible: what it is, which languages it understands, how far indexing has got and what a change will cost.

This pulls "Embeddings in the plugin" forward from the roadmap's Phase 3. It starts only after the spike in add-embedded-graph-store passes.

## What Changes

- A **Search view** (command "Typed Graph: Search", ribbon icon; full screen on phones) with query, mode, type and target controls, a model status chip, grouped results with heading path, snippet and matching Facts, a "why?" explanation, and open-at-heading on tap.
- A **Related notes** panel for the active note: nearest Cards plus graph neighbors, using stored vectors only, so it works without the model downloaded once the vector pack has synced.
- **Copy context pack**: runs retrieve for the query and copies cited markdown to the clipboard; the plugin never calls an LLM.
- **Settings → Search**: a model card (name, languages, dimension, size, short fingerprint, who chose it), per-device state (on or off, store size, counts, waiting items, pause, rebuild, delete local store), and vault-level choices ("Change model…", "Share embeddings across devices").
- **First-run setup**: samples the vault's script mix, recommends `minilm-l6` or `e5-small-multi`, shows size, estimated indexing time on this device and whether it runs well here, then downloads weights from a pinned URL with sha256 verification.
- The model choice is per vault and synced in `data.json`; "semantic search on this device" is per device and not synced.
- README discloses the weight download (Obsidian developer policy on network use).

## Capabilities

### New Capabilities
- `plugin-search`: the search view, related notes, copy context pack, status chip and explanations.
- `model-setup`: first-run recommendation, weight download and verification, per-vault model choice, per-device opt-out, model change confirmation and the settings model card.

### Modified Capabilities

None; `embedding-provider` was updated by add-local-embedding to allow plugin embedding.

## Impact

- `packages/plugin`: search view, related panel, settings section, first-run modal, weights downloader (via `requestUrl`), embedding Worker host, device settings in `localStorage` keyed by vault.
- `README.md` and website: network disclosure, model table, privacy note.
- Release assets: pinned weights for `bge-small-en` and `e5-small-multi`; `minilm-l6` weights also published as a release asset for the plugin.
