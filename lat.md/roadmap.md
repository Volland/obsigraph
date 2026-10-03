# Roadmap

Delivery is phased as thin end-to-end slices so the data model and query path are proven before the heavier systems are built.

## v0.1 usable core

Edge parser, graph model, a Cypher subset engine and `graph-query` blocks with table and graph rendering, plus the Graph view leaf.

Styling is a settings-level default per type; there are no schema notes yet. This phase carries most of the risk.

## v0.2 typing and config

Schema notes, per-type visualization, `{{edge: ...}}` embeds, pinned IDs and warnings, and `WITH`, `OPTIONAL MATCH` and variable-length paths.

## v0.3 Ladybug

The one-way [[ladybug-mirror|mirror]], the Ladybug backend behind the shared query interface, and the cross-engine conformance suite.

## v0.4 RAG

The embedding provider interface, chunking and edge verbalization, the vector index, and the [[sidecar]] with REST and MCP.

## Open questions

Sign semantics, exact Graph Link Types compatibility, the visualization config precedence and the precise Cypher subset boundary are unresolved.
