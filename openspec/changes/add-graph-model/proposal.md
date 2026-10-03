## Why

Parsed edges need to become a queryable property graph: notes as typed nodes, stubs for missing targets, stable edge IDs, and cheap incremental updates. See lat.md/graph-model.

## What Changes

- Add the in-memory graph store with per-file contribution tracking.
- Resolve link targets through an injected resolver; create reference-counted stub nodes.
- Derive node labels from frontmatter `type`; expose frontmatter, path and title as properties.
- Derive edge IDs `source#type#target#n`, honoring a pinned `id`.
- Support incremental add, modify, rename and delete.

## Capabilities

### New Capabilities
- `graph-model`: The in-memory property graph built from the vault and kept current incrementally.

### Modified Capabilities

## Impact

- New graph module in `packages/core` and tests. Depends on `edge-parsing`. No UI.
