# Architecture

A standalone Obsidian plugin that turns a vault into a typed, labeled, signed property graph with openCypher queries, plus an optional sidecar that serves the same graph as RAG storage.

## Standalone plugin

The plugin owns its parser, index and graph view and does not require Dataview or Graph Link Types. It reads Graph Link Types' inline-field syntax for compatibility only.

Edge properties, signed edges and typed nodes do not fit Dataview's page-and-field model, and the core graph view cannot draw labeled edges, so building on either would mean fighting both.

## Monorepo layout

Three packages share one model: `core` (no Obsidian APIs), `plugin` (Obsidian UI) and `sidecar` (headless Node service).

`core` holds the [[edge-syntax|edge parser]], the [[graph-model|graph model]], schema handling, the [[query-engine|Cypher subset engine]] and the [[vector-search#Edge verbalization|edge verbalizer]]. Keeping it free of Obsidian imports lets the [[sidecar]] reuse it unchanged.

## Source of truth

Markdown files are the only source of truth; every other store (in-memory index, Ladybug mirror, vector index) is derived and rebuildable.

See [[ladybug-mirror#One-way mirror]] for why writes never flow from a database back into notes.
