## 1. Style resolution

- [x] 1.1 Implement the pure per-attribute resolver over block header, schema, settings and defaults in `packages/core`
- [x] 1.2 Validate colors, shapes and icons with diagnostics and fall-through
- [x] 1.3 Implement multi-label first-wins resolution

## 2. Sources

- [x] 2.1 Read the `visualization` section from schema notes for node and edge types
- [x] 2.2 Parse `style` entries in the `graph-query` block header
- [x] 2.3 Keep settings defaults as the third level

## 3. Rendering

- [x] 3.1 Generate Cytoscape style sheets from resolved styles in the shared renderer
- [x] 3.2 Render negative-sign edges distinctly by default
- [x] 3.3 Re-style on schema or settings change while preserving layout
- [x] 3.4 Show the supplying source per attribute in the Graph view details panel

## 4. Tests

- [x] 4.1 Write tests covering every scenario in the visualization-config spec

## 5. Sync

- [x] 5.1 Record the precedence decision in lat.md/visualization and remove it from lat.md/roadmap open questions, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
