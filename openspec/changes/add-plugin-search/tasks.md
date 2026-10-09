## 0. Gate

- [ ] 0.1 Confirm the spike in add-embedded-graph-store passed (startup, IDBFS, memory) before starting

## 1. Search view

- [ ] 1.1 Search view leaf, command and ribbon icon; controls for mode, type and target
- [ ] 1.2 Result rendering with heading path, snippet, Fact chips and open-at-heading
- [ ] 1.3 Status chip states and link to settings
- [ ] 1.4 "why?" explanation

## 2. Related notes and context pack

- [ ] 2.1 Related notes leaf following the active file, Card cosine fused with neighbors
- [ ] 2.2 Copy context pack command and button

## 3. Model setup

- [ ] 3.1 Script-mix sampler and recommendation; device benchmark and estimates
- [ ] 3.2 Weights downloader with pinned URLs and sha256, stored in IndexedDB
- [ ] 3.3 Per-vault choice in `data.json`, per-device flags in `localStorage`; react to synced changes with a shadow build
- [ ] 3.4 Model change confirmation
- [ ] 3.5 Settings → Search model card and device actions

## 4. Mobile

- [ ] 4.1 Foreground-and-idle scheduling of the vector phase; pause on hidden; pause setting
- [ ] 4.2 Full-screen search on phones; touch targets

## 5. Tests

- [ ] 5.1 Write tests covering every scenario in the plugin-search and model-setup specs (Obsidian API mocked as in existing plugin tests)
- [ ] 5.2 Plugin and CLI return the same top results for the example vault
- [ ] 5.3 Manual verification on one iPhone and one Android phone, recorded in the change

## 6. Docs and release

- [ ] 6.1 README network disclosure and model table; website page
- [ ] 6.2 Update `lat.md/embedded-search.md`, `lat.md/vector-search.md` (the plugin now embeds) and `lat.md/roadmap.md`; test-spec sections with `@lat:` refs; `tg check`
