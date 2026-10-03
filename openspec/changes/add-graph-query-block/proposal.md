## Why

The engine needs a surface: a note-embedded `graph-query` block that shows a table or a labeled, signed graph and updates as the vault changes. This is also the first change that runs inside Obsidian. See lat.md/query-engine and lat.md/visualization.

## What Changes

- Plugin entry and settings with per-type default styles.
- Feed `core` from the vault: batched indexing, Obsidian-backed link resolver, metadata-cache events with debounce.
- Shared Cytoscape.js `GraphRenderer` and a table renderer, with an element cap and table fallback.
- The `graph-query` code block: header (`view`, `columns`), result-shape renderer choice, in-place errors, live refresh.

## Capabilities

### New Capabilities
- `graph-query-block`: The `graph-query` fenced block and its rendering.

### Modified Capabilities

## Impact

- New `packages/plugin` code, esbuild build, Cytoscape.js dependency. Depends on `cypher-query`.
