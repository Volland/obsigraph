---
openspec: [node-vault-loader]
---
# Architecture

A standalone Obsidian plugin that turns a vault into a typed, labeled, signed property graph with openCypher queries, plus an optional sidecar that serves the same graph as RAG storage.

## Standalone plugin

The plugin owns its parser, index and graph view and does not require Dataview or Graph Link Types. It reads Graph Link Types' inline-field syntax for compatibility only.

Edge properties, signed edges and typed nodes do not fit Dataview's page-and-field model, and the core graph view cannot draw labeled edges, so building on either would mean fighting both.

## Monorepo layout

Packages share one model: `core` (no Obsidian APIs), `plugin` (Obsidian UI), `sidecar` (headless Node service), `cli` (`tg`), and three host-independent helpers, `node-vault`, `graph-ui` and `vscode`.

`core` holds the [[edge-syntax|edge parser]], the [[graph-model|graph model]], schema handling, the [[query-engine|Cypher subset engine]] and the [[vector-search#Edge verbalization|edge verbalizer]]. Keeping it free of Obsidian imports lets the [[sidecar]] reuse it unchanged.

`node-vault` is the stateless Node half of reading a vault: [[packages/node-vault/src/index.ts#listMarkdown]] and [[packages/node-vault/src/index.ts#readNote]] turn a directory into note inputs for the graph. The sidecar and the VS Code extension both use it; watching stays per host. `graph-ui` is the shared renderer, see [[visualization#Shared renderer]]. `vscode` is the extension, see [[vscode]].

## Source of truth

Markdown files are the only source of truth; every other store (in-memory index, Ladybug mirror, vector index) is derived and rebuildable.

See [[ladybug-mirror#One-way mirror]] for why writes never flow from a database back into notes.
