## 1. Core

- [x] 1.1 Read `type: edge` notes in `Graph.upsertNote` into one edge with endpoints, type, sign, id and properties from frontmatter, and no node
- [x] 1.2 Record the declaring note as `GraphEdge.file`; re-resolve edge notes when either endpoint appears or disappears
- [x] 1.3 Report `edge-note` diagnostics for missing fields and for links to edge notes
- [x] 1.4 Report schema validation findings and embed warnings at the declaring file

## 2. Rendering

- [x] 2.1 `neighborhood` of an edge note returns its edge and both endpoints
- [x] 2.2 VS Code backlinks open the declaring file

## 3. Tests and docs

- [x] 3.1 Tests for every scenario in the graph-model and graph-ui deltas
- [x] 3.2 Update lat.md edge-syntax and graph-model, add test specs, run `lat check` and `openspec validate add-edge-notes --strict`
