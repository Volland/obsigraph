## Why

Issue #3: `graph-query` blocks with `view: graph` fail on every render with "Cannot read properties of undefined". `QueryBlock.onload()` rendered synchronously, before the browser had attached and sized the container, so `clientWidth` was 0 when Cytoscape was constructed. Cytoscape then ran its default grid layout on the empty bootstrap graph, and the layout's bounding-box calculation crashed on the zero-size container.

## What Changes

- `GraphRenderer` constructs Cytoscape with the `null` layout, so nothing is laid out until elements are added.
- `QueryBlock.onload()` defers the first render to the next animation frame, and cancels it on unload so a block that goes away first never creates a renderer.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `graph-query-block`: first render waits for a sized container.

## Impact

- `packages/graph-ui/src/graph-renderer.ts`, `packages/plugin/src/query/query-block.ts`.
- The Graph view and the VS Code webview share the renderer and get the `null` layout too; they already create it after layout.
