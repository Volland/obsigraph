## 1. Parser

- [x] 1.1 Extend the grammar for `WITH` with alias, `WHERE`, `ORDER BY`, `LIMIT`
- [x] 1.2 Parse `OPTIONAL MATCH` with its own `WHERE`
- [x] 1.3 Parse length bounds `*`, `*n`, `*n..m`, `*..m`, `*n..` and path variables
- [x] 1.4 Parse aggregate function calls including `count(*)`

## 2. Evaluator

- [x] 2.1 Refactor evaluation into a clause pipeline over row streams
- [x] 2.2 Implement `WITH` scoping and projection
- [x] 2.3 Implement `OPTIONAL MATCH` null binding
- [x] 2.4 Implement variable-length expansion with relationship uniqueness, depth cap setting and truncation notice
- [x] 2.5 Implement grouping and the six aggregations with null and empty-input rules
- [x] 2.6 Raise type errors for non-numeric `sum` and `avg`

## 3. Errors and shapes

- [x] 3.1 Keep unsupported-clause and function errors naming the item and pointing at Ladybug
- [x] 3.2 Confirm aggregate and list results render as tables and paths as graphs

## 4. Tests

- [x] 4.1 Write tests covering every scenario in the cypher-extensions spec

## 5. Sync

- [x] 5.1 Update lat.md/query-engine supported subset, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
