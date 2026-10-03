# Visualization

Graph rendering is done by the plugin itself with Cytoscape.js, because the core graph view cannot show edge labels, signs or typed shapes.

## Surfaces

Two surfaces share one renderer and one config: inline `graph-query` blocks and a full-pane Graph view leaf.

Only the leaf supports click-to-expand of neighbors. Patching or replacing the core graph view is explicitly out of scope because it is fragile across Obsidian updates.

## Styling

Node and edge styles are generated as Cytoscape style sheets from type definitions: color, shape, icon, label and sign rendering.

Precedence between schema notes, block headers and plugin settings is still open. Vaults beyond roughly 5-10k nodes are handled by scoping queries, not by swapping renderer.
