---
lat:
  require-code-mention: true
---
# MCP and GraphRAG Tests

Test specifications for the sidecar's MCP tools and hybrid retrieve described in [[sidecar#Interfaces]], run through the official MCP client over HTTP and stdio.

## Three read-only tools listed

An authenticated client sees `cypher_query`, `vector_search` and `graphrag_retrieve`, each with a description, an object input schema and read-only annotations.

## Token required for MCP

MCP over HTTP without a token gets 401, a wrong token fails to connect, and the configured token works.

## Cypher tool reads

`cypher_query` returns `{columns, rows}` for a read query.

## Cypher tool rejects writes

A write query is a tool error naming the rejected clause, and the graph does not change.

## Vector search tool

`vector_search` returns at most k node hits with title, score and a citation of path, heading and text.

## Retrieve expands one hop

`graphrag_retrieve` at depth 1 returns chunks of hit notes and of notes one edge away, with the connecting edges and an untrusted-content notice.

## Edge hit seeds both endpoints

When an edge sentence is a hit, both endpoint notes enter the seed set at distance 0.

## Depth zero returns hits only

At depth 0 every returned chunk is a hit chunk.

## Citations with and without heading

Chunks cite path and heading, or path and no heading for text before the first heading.

## Hits before neighbors

Hit chunks come first, followed by neighbor chunks ordered by distance, each reporting its distance.

## Hub expansion capped

A hub with more neighbors than the cap expands only up to the cap and the result is marked truncated.

## REST retrieve parity

`POST /retrieve` with the same arguments returns exactly the MCP tool's result.

## Retrieve degrades without embeddings

With the provider down, retrieve is a tool error saying embeddings are unavailable while Cypher still works.

## Stdio mode

The built `server.mjs --stdio` serves the same three tools over stdio without a token or HTTP listener.
