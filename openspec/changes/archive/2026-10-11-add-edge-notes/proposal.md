## Why

An edge's properties live in a `{...}` block on one line. That is fine for `since: 2020`, but a relationship with real content (a contract, a meeting, a long rationale) has no place for a body, cannot be edited in Obsidian's Properties panel and does not show up as a row in Bases. lat.md/edge-syntax already names "edge notes" as the escape hatch; nothing implements them.

## What Changes

- A note with frontmatter `type: edge` declares one edge instead of a node: `from` and `to` name the endpoints as links, `edgeType` names the type (with an optional `+`/`-` sign prefix), `id` pins the edge id, and every other frontmatter field becomes an edge property.
- The edge note is not a node. Its edge is an ordinary graph edge from `from` to `to`, so every surface that renders the graph (Obsidian graph view, query blocks, VS Code webview, sidecar) draws it as an edge with no host changes.
- Its id is the pinned `id`, otherwise the note's path, so it is stable and never collides with derived ids. The edge records the declaring note's path, so diagnostics and backlinks point at the edge note.
- Missing endpoints become stubs as for any edge. A missing `from`, `to` or `edgeType` gives an `edge-note` diagnostic and no edge. A link to an edge note gives an `edge-note` diagnostic and no edge, since edge notes are not nodes.
- Opening an edge note in the graph view shows its edge and both endpoints.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `graph-model`: edge notes contribute an edge and no node.
- `graph-ui`: the neighborhood of an edge note is its edge and endpoints.

## Impact

- `packages/core`: `Graph.upsertNote` reads edge notes, `GraphEdge.file`, `Graph.declaredEdges`; schema validation and embed warnings report at the declaring file.
- `packages/graph-ui`: `neighborhood` for edge notes.
- `packages/vscode`: backlinks open the declaring file.
- `lat.md/edge-syntax`, `lat.md/graph-model`, tests.
