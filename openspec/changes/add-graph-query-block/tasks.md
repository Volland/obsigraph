## 1. Plugin shell

- [ ] 1.1 Implement the plugin entry, esbuild build, manifest and settings tab with per-type default styles
- [ ] 1.2 Feed `core` from the vault: batched indexing, Obsidian-backed link resolver, reading changed note text
- [ ] 1.3 Subscribe to metadata-cache events and notify subscribers with a debounce

## 2. Rendering

- [ ] 2.1 Build the shared `GraphRenderer` on Cytoscape.js with a generated style sheet
- [ ] 2.2 Style edges as labeled arrows, positive solid and negative dashed, and stub nodes distinctly
- [ ] 2.3 Build the table renderer with node titles linking to notes
- [ ] 2.4 Add the element cap with notice and table fallback

## 3. graph-query block

- [ ] 3.1 Implement the pure block module: header parsing, renderer choice, `view` and `columns` overrides
- [ ] 3.2 Register the code block processor with in-place errors and visible-only live refresh
- [ ] 3.3 Write unit tests for the pure module covering every graph-query-block spec scenario that does not need a DOM

## 4. Sync

- [ ] 4.1 Add lat.md test-spec section and `@lat:` refs, update lat.md/visualization, run `lat check` and `openspec validate`
