# Visualization

Graph rendering is done by the plugin itself with Cytoscape.js, because the core graph view cannot show edge labels, signs or typed shapes.

## Surfaces

Two surfaces share one renderer and one config: inline `graph-query` blocks and a full-pane Graph view leaf.

Both use [[packages/plugin/src/render/graph-renderer.ts#GraphRenderer]]. Inline blocks are driven by [[packages/plugin/src/query/query-block.ts#QueryBlock]], which re-runs only while visible and reuses its renderer across refreshes to avoid flicker; [[packages/plugin/src/query/plan.ts#planRender]] picks graph or table and falls back to a table above the element cap. Only the leaf, [[packages/plugin/src/view/graph-view.ts#GraphView]], supports click-to-expand of neighbors; with an empty query it follows the active note's [[packages/plugin/src/view/view-state.ts#neighborhood]] and keeps expanded nodes across live refreshes. Patching or replacing the core graph view is explicitly out of scope because it is fragile across Obsidian updates.

## Styling

Node and edge styles are generated as Cytoscape style sheets from type definitions: color, shape, icon, label and sign rendering.

Precedence, highest first, per attribute: `graph-query` block header (`node.<Type>:` / `edge.<type>:` lines), schema notes (`visualization` block, with `edges` for edge types), plugin settings, built-in default. All schema notes form one level, so a multi-label node takes each attribute from its first label that supplies it. Settings rank below schema notes because they are device-local and do not sync. Resolved by [[packages/core/src/style/style.ts#resolveNodeStyle]] and [[packages/core/src/style/style.ts#resolveEdgeStyle]]; invalid values are dropped with a diagnostic naming source and attribute and fall through.

Node attributes are color, shape, icon (Lucide, drawn as a white SVG background) and label property; edge attributes are color and line. Negative edges default to dashed red and always get a tee arrow and a minus prefix; stubs are faded and dashed. [[packages/plugin/src/render/styler.ts#makeStyler]] turns resolved styles into element data for a data-driven sheet from [[packages/plugin/src/render/styles.ts#buildStylesheet]], so a style change or an unchanged query result restyles in place without moving nodes. The Graph view details panel shows each attribute's origin. Theme colors are read from Obsidian CSS variables. Vaults beyond roughly 5-10k nodes are handled by scoping queries, not by swapping renderer.
