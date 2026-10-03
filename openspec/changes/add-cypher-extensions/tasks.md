## 1. Parser

- [ ] 1.1 Extend the grammar for `WITH` with alias, `WHERE`, `ORDER BY`, `LIMIT`
- [ ] 1.2 Parse `OPTIONAL MATCH` with its own `WHERE`
- [ ] 1.3 Parse length bounds `*`, `*n`, `*n..m`, `*..m`, `*n..` and path variables
- [ ] 1.4 Parse aggregate function calls including `count(*)`

## 2. Evaluator

- [ ] 2.1 Refactor evaluation into a clause pipeline over row streams
- [ ] 2.2 Implement `WITH` scoping and projection
- [ ] 2.3 Implement `OPTIONAL MATCH` null binding
- [ ] 2.4 Implement variable-length expansion with relationship uniqueness, depth cap setting and truncation notice
- [ ] 2.5 Implement grouping and the six aggregations with null and empty-input rules
- [ ] 2.6 Raise type errors for non-numeric `sum` and `avg`

## 3. Errors and shapes

- [ ] 3.1 Keep unsupported-clause and function errors naming the item and pointing at Ladybug
- [ ] 3.2 Confirm aggregate and list results render as tables and paths as graphs

## 4. Tests

- [ ] 4.1 Write tests covering every scenario in the cypher-extensions spec

## 5. Sync

- [ ] 5.1 Update lat.md/query-engine supported subset, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
