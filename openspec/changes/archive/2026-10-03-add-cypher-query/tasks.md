## 1. Parser

- [x] 1.1 Implement the lexer and recursive-descent parser for MATCH, WHERE, RETURN, ORDER BY, LIMIT
- [x] 1.2 Reject write clauses; report unsupported clauses by name and syntax errors with line and column

## 2. Executor

- [x] 2.1 Implement pattern matching with label and relationship-type filters, directed and undirected
- [x] 2.2 Implement the expression evaluator for WHERE and property access including `r.sign`, `r.id`, `n.stub`
- [x] 2.3 Implement ORDER BY, LIMIT and the result shape with column kinds
- [x] 2.4 Write a table of accepted and rejected queries as tests covering every scenario in the cypher-query spec

## 3. Sync

- [x] 3.1 Add lat.md test-spec section and `@lat:` refs, link query symbols from lat.md/query-engine, run `lat check` and `openspec validate`
