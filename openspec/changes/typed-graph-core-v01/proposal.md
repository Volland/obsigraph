## Why

Obsidian's core graph view cannot show edge labels, signs, edge properties or node types, and Graph Link Types and Dataview cannot model properties on edges. We want a vault to behave like a real labeled, signed property graph that can be queried with openCypher. v0.1 proves the data model and query path end to end before heavier systems (Ladybug, vectors, sidecar) are built on top.

## What Changes

- Add a monorepo with two packages: `core` (no Obsidian APIs) and `plugin` (Obsidian UI).
- Parse inline edges of the form `type:: [[Target]] {props}` with an optional `+`/`-` sign prefix on the type; plain Graph Link Types lines remain valid and unchanged.
- Build an in-memory property graph: one note is one node, unresolved links become stub nodes, `type:` frontmatter yields labels, edges get derived IDs `source#type#target#n` and an optional pinned `id`.
- Add a read-only openCypher subset engine: `MATCH`, `WHERE`, `RETURN`, `ORDER BY`, `LIMIT`; unsupported clauses fail with a clear error.
- Add the `graph-query` code block (header with `view`, columns, styling, then Cypher) that renders a table or a Cytoscape.js graph chosen by result shape, and re-runs on note changes.
- Add a full-pane Graph view leaf sharing the renderer, with click-to-expand of neighbors.
- Assumption (sign semantics still open): sign is a polarity of +1 or -1, default +1, exposed as `r.sign`; `weight` is an ordinary numeric property and does not affect sign.
- Out of scope for v0.1: schema notes, `{{edge: ...}}` embeds, pinned-ID warnings, LadybugDB, vector search, the sidecar, `WITH`, `OPTIONAL MATCH`, variable-length paths, aggregations.

## Capabilities

### New Capabilities
- `edge-parsing`: Parse typed, signed edges with an optional property block from note bodies, including Graph Link Types compatibility.
- `graph-model`: Build and incrementally update the in-memory property graph with nodes, stubs, labels and edge IDs.
- `cypher-query`: Parse and execute the read-only openCypher subset against the graph model.
- `graph-query-block`: The `graph-query` fenced block, its header options and result-shape-driven rendering.
- `graph-view`: The full-pane Graph view leaf with Cytoscape rendering and neighbor expansion.

### Modified Capabilities
<!-- None: there are no existing specs. -->

## Impact

- New code: a `core` package and an Obsidian `plugin` package; new build tooling and dependencies (Cytoscape.js).
- Reads vault markdown and frontmatter through Obsidian's metadata cache and vault APIs; writes nothing to notes.
- Design intent is recorded in `lat.md/` (architecture, edge-syntax, graph-model, query-engine, visualization, roadmap), which must stay in sync as code lands.
