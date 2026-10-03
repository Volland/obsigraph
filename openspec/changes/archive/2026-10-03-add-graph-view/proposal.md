## Why

Inline blocks answer fixed questions; users also need to explore. A full-pane Graph view with click-to-expand gives that, reusing the shared renderer. See lat.md/visualization.

## What Changes

- Register a Graph view leaf and an open command with a query bar.
- Default to the active note's neighborhood.
- Neighbor expansion, open-note on double-click or modifier-click, and a selection details panel.

## Capabilities

### New Capabilities
- `graph-view`: Full-pane exploratory graph view sharing the inline renderer.

### Modified Capabilities

## Impact

- New view code in `packages/plugin`. Depends on `graph-query-block` (renderer, indexing).
