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
The system SHALL return a clear error from vector search and retrieve when the embedding provider is unavailable or the index model mismatches, while `cypher_query` continues to work.

#### Scenario: Provider down
- **WHEN** the embedding endpoint is unreachable and an agent calls `graphrag_retrieve`
- **THEN** the tool returns an error stating embeddings are unavailable, and a following `cypher_query` call succeeds

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
