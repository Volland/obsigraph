# sidecar-mcp-graphrag Specification

## Purpose
Defines the MCP tools and the hybrid GraphRAG retrieval offered by the sidecar, so agents can query the vault graph, search it semantically, and receive answers grounded in cited note passages.

## Requirements

### Requirement: MCP server with three tools
The system SHALL expose an MCP server offering a Cypher query tool, a vector search tool and a hybrid GraphRAG retrieve tool, each with a described input schema.

#### Scenario: Tool listing
- **WHEN** an authenticated MCP client lists tools
- **THEN** it sees `cypher_query`, `vector_search` and `graphrag_retrieve` with descriptions and input schemas

### Requirement: MCP authentication
The system SHALL require the same bearer token for MCP over HTTP as for REST, and SHALL reject unauthenticated MCP requests before any tool executes.

#### Scenario: No token
- **WHEN** an MCP request over HTTP carries no token
- **THEN** it is rejected with 401 and no tool is invoked

#### Scenario: Valid token
- **WHEN** an MCP request carries the configured token
- **THEN** the tool call is processed

### Requirement: Cypher query tool
The system SHALL execute a read-only Cypher query through the MCP tool and SHALL return columns and rows, and SHALL return a tool error for write clauses or syntax errors.

#### Scenario: Read query
- **WHEN** an agent calls `cypher_query` with `MATCH (n:Person) RETURN n.name LIMIT 3`
- **THEN** it receives a result with column `n.name` and at most three rows

#### Scenario: Write query
- **WHEN** an agent calls `cypher_query` with a `DELETE` statement
- **THEN** the tool returns an error naming the rejected clause and nothing changes

### Requirement: Vector search tool
The system SHALL accept a query text, a target of nodes or edges, an optional node type filter and k, and SHALL return scored results with citations.

#### Scenario: Node search
- **WHEN** an agent calls `vector_search` for nodes with k = 3
- **THEN** it receives at most three results, each with node name, score, note path, heading and the matching text

### Requirement: Hybrid GraphRAG retrieve
The system SHALL, given a question, find the top vector hits over nodes and edges, expand the graph neighborhood of the hit nodes to a configurable depth, and return the relevant chunks with citations.

#### Scenario: Retrieve with expansion
- **WHEN** an agent calls `graphrag_retrieve` for "Who works with Alice on the search project?" with depth 1
- **THEN** the result includes chunks from the hit notes and from notes one edge away, and lists the connecting edges

#### Scenario: Edge hit contributes both endpoints
- **WHEN** the best vector hit is an edge sentence
- **THEN** both endpoint nodes are included in the expansion seed set

#### Scenario: Depth zero
- **WHEN** depth is 0
- **THEN** only chunks of the vector hits are returned

### Requirement: Citations on every chunk
The system SHALL attach to every returned chunk the note path, the nearest heading when present, and the chunk text, so a client can quote and link the source.

#### Scenario: Chunk with heading
- **WHEN** a returned chunk comes from `## Career` of `People/Alice.md`
- **THEN** its citation holds path `People/Alice.md`, heading `Career` and the chunk text

#### Scenario: Chunk without heading
- **WHEN** a returned chunk precedes the first heading
- **THEN** its citation holds the path and no heading

### Requirement: Relevance ordering and provenance of hits
The system SHALL order returned chunks so direct vector hits come first by score, followed by neighborhood chunks, and SHALL mark each chunk as a direct hit or a neighbor with its graph distance.

#### Scenario: Mixed results
- **WHEN** a retrieve returns hit chunks and neighbor chunks
- **THEN** hit chunks precede neighbor chunks and each neighbor reports its distance from a hit

### Requirement: Bounded output
The system SHALL cap the number of expanded neighbors, returned chunks and total returned text size, and SHALL report when results were truncated.

#### Scenario: Hub node
- **WHEN** a hit node has more neighbors than the cap
- **THEN** only the highest-scoring neighbors up to the cap are expanded and the response states that truncation occurred

### Requirement: Degraded retrieval without vectors
The system SHALL return a clear error stating embeddings are unavailable from vector search and retrieve when the embedding provider is unreachable or vectors are disabled. When the index model mismatches the active model, both tools SHALL answer from the existing index with `stale: true` and a notice naming both models if the dimensions are equal, and SHALL return an error asking for a rebuild if they differ. `cypher_query` SHALL keep working in every case.

#### Scenario: Provider down
- **WHEN** the embedding endpoint is unreachable and an agent calls `graphrag_retrieve`
- **THEN** the tool returns an error stating embeddings are unavailable, and a following `cypher_query` call succeeds

#### Scenario: Model mismatch with equal dimensions
- **WHEN** the index was built with one 768-dimension model, the active model is another 768-dimension model and an agent calls `graphrag_retrieve`
- **THEN** the answer has `stale: true` and a notice naming both models

#### Scenario: Model mismatch with different dimensions
- **WHEN** the index has 768-dimension vectors, the active model produces 1024 dimensions and an agent calls `vector_search`
- **THEN** the tool returns an error asking for a rebuild and no similarity score is computed

### Requirement: REST parity for hybrid retrieve
The system SHALL expose hybrid retrieve over the REST API with the same inputs and outputs as the MCP tool.

#### Scenario: REST retrieve
- **WHEN** an authenticated client posts the same question and parameters to the REST retrieve endpoint
- **THEN** the response has the same chunks, citations and ordering as the MCP tool

### Requirement: Read-only tools
The system SHALL NOT offer any MCP tool that modifies the vault or the derived stores.

#### Scenario: Tool surface
- **WHEN** the tool list is inspected
- **THEN** no tool creates, edits or deletes notes or index entries

### Requirement: Untrusted content marking
The system SHALL mark returned chunk text as untrusted vault content, to be treated as data and not as instructions, in every retrieve response and in the descriptions of the search and retrieve tools.

#### Scenario: Notice in the response
- **WHEN** an agent calls `graphrag_retrieve`
- **THEN** the response includes the untrusted-content notice next to the chunks

### Requirement: Retrieve parameter bounds
The system SHALL accept retrieve parameters within documented ranges and defaults (`k` 1–50, default 5; `depth` 0–3, default 1; `neighbor_cap` 1–50, default 8; `chunk_cap` 1–100, default 20) and SHALL reject an out-of-range value as a client error naming the parameter (HTTP 400 over REST, a tool error over MCP).

#### Scenario: Depth too large
- **WHEN** an agent calls `graphrag_retrieve` with `depth` 5
- **THEN** the call fails with an error naming `depth` and its range

### Requirement: Server identity
The MCP server SHALL identify itself as `typed-graph` with the version of the installed sidecar package.

#### Scenario: Version reported
- **WHEN** an MCP client initializes a session with sidecar 0.9.1
- **THEN** the server info reports name `typed-graph` and version `0.9.1`
