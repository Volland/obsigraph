# Sidecar

A headless Docker service that mounts a vault read-only and serves it as RAG-ready graph and vector storage, with no Obsidian running.

## Shared core

The sidecar imports the same `core` package as the plugin, so edge syntax, IDs and queries behave identically in both.

It watches the vault directory, maintains the [[ladybug-mirror|Ladybug mirror]] and the [[vector-search|vector index]] server-side, which also lifts the desktop-only limit on vector search.

## Interfaces

The sidecar exposes a REST API and an MCP server offering Cypher queries, vector search and a hybrid GraphRAG retrieve call.

Hybrid retrieve takes vector hits, expands their graph neighborhood and returns cited chunks, so agents such as Claude can use the vault directly.
