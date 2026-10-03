# Visualization

Graph rendering is done by the plugin itself with Cytoscape.js, because the core graph view cannot show edge labels, signs or typed shapes.

## Surfaces

Two surfaces share one renderer and one config: inline `graph-query` blocks and a full-pane Graph view leaf.

Both use [[packages/plugin/src/render/graph-renderer.ts#GraphRenderer]]. Inline blocks are driven by [[packages/plugin/src/query/query-block.ts#QueryBlock]], which re-runs only while visible and reuses its renderer across refreshes to avoid flicker; [[packages/plugin/src/query/plan.ts#planRender]] picks graph or table and falls back to a table above the element cap. Only the leaf, [[packages/plugin/src/view/graph-view.ts#GraphView]], supports click-to-expand of neighbors; with an empty query it follows the active note's [[packages/plugin/src/view/view-state.ts#neighborhood]] and keeps expanded nodes across live refreshes. Patching or replacing the core graph view is explicitly out of scope because it is fragile across Obsidian updates.

## Styling

Node and edge styles are generated as Cytoscape style sheets from type definitions: color, shape, icon, label and sign rendering.

Built by [[packages/plugin/src/render/styles.ts#buildStylesheet]]: edges carry their type label, negative edges are dashed red with a tee arrow and a minus prefix, stubs are faded and dashed, and type colors come from the settings JSON or a stable palette. Theme colors are read from Obsidian CSS variables so light and dark mode both work. Precedence between schema notes, block headers and plugin settings is planned in the add-visualization-config change. Vaults beyond roughly 5-10k nodes are handled by scoping queries, not by swapping renderer.
