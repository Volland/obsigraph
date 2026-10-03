## Why

Agents such as Claude need to use the vault directly. An MCP server and a hybrid retrieval call that returns cited chunks turn the sidecar into usable GraphRAG storage. See lat.md/sidecar#Interfaces.

## What Changes

- Add an MCP server to the sidecar with tools for Cypher query, vector search and hybrid GraphRAG retrieve.
- Add the hybrid retrieve: vector hits, graph neighborhood expansion, and cited chunks with note path and heading.
- Expose hybrid retrieve over REST as well, with the same inputs and outputs.
- Apply the same token authentication and read-only guarantees as the REST API.

## Capabilities

### New Capabilities
- `sidecar-mcp-graphrag`: MCP tools and hybrid GraphRAG retrieval with citations over the sidecar's graph and vector index.

### Modified Capabilities

## Impact

- Extends `packages/sidecar`; depends on `add-sidecar-service` and `add-vector-index`.
- Assumptions: MCP over streamable HTTP on the same listener and token as REST, with a stdio mode as an optional launch mode for local clients; tool names are `cypher_query`, `vector_search` and `graphrag_retrieve`. Defaults: top 5 vector hits, expansion depth 1, caps on neighbors and returned chunks. Neighborhood nodes contribute their best-matching chunk to the query, or their first chunk when no vectors exist.
