## 1. Core

- [x] 1.1 Build `CodeFile` and `CodeSymbol` nodes from the provider and annotations
- [x] 1.2 Add edges from annotations with type, sign and properties
- [x] 1.3 Implement the `code` setting modes in the graph builder

## 2. Query and style

- [x] 2.1 Verify Cypher over code nodes on the built-in engine
- [ ] 2.2 Mirror code nodes in the Ladybug mirror and add conformance queries (deferred: the sidecar reads only markdown, so code nodes need its own source scan)
- [x] 2.3 Add default styles for code node types

## 3. Plugin

- [x] 3.1 Add the `code` setting and code-root setting
- [x] 3.2 Add the Code toggle to the Graph view and a `code:` header option
- [x] 3.3 Scan and re-scan on file change

## 4. Tests

- [x] 4.1 Write tests covering every scenario in the code-layer spec

## 5. Sync

- [x] 5.1 Document in lat.md/cli and lat.md/visualization, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
