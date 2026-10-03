## 1. Retrieval

- [ ] 1.1 Implement hybrid retrieve: question embedding, node and edge hits, seed set from hits and edge endpoints
- [ ] 1.2 Implement neighborhood expansion with depth, per-node and total caps and neighbor ranking
- [ ] 1.3 Select best chunks per node and build structured citations with role and distance
- [ ] 1.4 Add truncation reporting and output size caps

## 2. Interfaces

- [ ] 2.1 Implement the MCP server over streamable HTTP on the existing listener with token auth, plus a stdio launch mode
- [ ] 2.2 Register `cypher_query`, `vector_search` and `graphrag_retrieve` with input schemas and descriptions, marking results as untrusted vault content
- [ ] 2.3 Add the REST retrieve endpoint sharing the same function as the MCP tool
- [ ] 2.4 Return clear tool errors for write clauses, syntax errors and unavailable embeddings

## 3. Tests

- [ ] 3.1 Build a small fixture vault with known graph and content for retrieval tests
- [ ] 3.2 Write tests covering every scenario in the sidecar-mcp-graphrag spec, including auth rejection and REST parity

## 4. Sync

- [ ] 4.1 Update lat.md/sidecar, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
