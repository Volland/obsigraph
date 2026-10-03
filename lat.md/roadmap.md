# Roadmap

Delivery is phased as thin end-to-end slices so the data model and query path are proven before the heavier systems are built.

## v0.1 usable core

Edge parser, graph model, a Cypher subset engine and `graph-query` blocks with table and graph rendering, plus the Graph view leaf.

Styling is a settings-level default per type; there are no schema notes yet. This phase carries most of the risk. Implemented and archived as five OpenSpec changes (edge-parsing, graph-model, cypher-query, graph-query-block, graph-view); the Obsidian shell still needs manual verification in a live vault.

## v0.2 typing and config

Done: add-schema-notes, add-visualization-config, add-edge-embeds, add-cypher-extensions. Schema notes, per-type visualization, `{{edge: ...}}` embeds, pinned IDs and warnings, and `WITH`, `OPTIONAL MATCH` and variable-length paths.

## v0.3 Ladybug

Reordered: add-sidecar-service first, then add-ladybug-mirror, add-ladybug-backend and add-engine-conformance, all inside the sidecar. The one-way [[ladybug-mirror|mirror]], the Ladybug backend behind the shared query interface, and the cross-engine conformance suite.

## v0.4 RAG

Planned as add-embedding-provider, add-chunking-verbalization, add-vector-index, add-sidecar-service and add-sidecar-mcp-graphrag. The embedding provider interface, chunking and edge verbalization, the vector index, and the [[sidecar]] with REST and MCP.

## Open questions

Sign semantics (v0.1 assumes prefix-only polarity) and exact Graph Link Types compatibility beyond the inline-field form remain unresolved. The v0.1 Cypher subset is pinned in [[query-engine#Supported subset]]; config precedence is settled in [[visualization#Styling]].
