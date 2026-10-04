---
lat:
  require-code-mention: true
---
# Code Layer Tests

Test specifications for the derived code nodes and edges built from source files and annotations, and their rendering. See [[cli#Code layer]].

## Derived code nodes

What the layer builds.

### Annotated symbol

A function carrying `@tg: implements:: [[auth#Login]] {since: 2}` becomes a `CodeSymbol` node with kind, language and line range, an `implements` edge with its property to the `Login` section node, and a `CodeFile` node for its file.

### Vault untouched

Building the layer, including `tg cypher --code all`, creates and modifies no file in the project.

## Code mode setting

The `off`, `annotated` and `all` modes.

### Off

With the mode off the graph has no code nodes and annotations produce no edges.

### Annotated only

In annotated mode only annotated symbols, the symbols annotations point at, and their files become nodes, while all mode adds every symbol with `contains` edges from file or class.

## Queryable code nodes

Cypher over code.

### Match code symbols

`MATCH (c:CodeSymbol)-[r:implements]->(s) RETURN c.path, s.title` returns one row per implementing symbol, and relationship signs are queryable.

## Link and node identity agree

A link and a node with the same target are the same node.

### Link from a note

A wiki link to `[[src/auth.ts#login]]` ends at the `CodeSymbol` node and creates no stub, both for section prose and for a typed edge in a plain note through the subpath resolver.

## Visible on demand

Showing code in the graph.

### Toggle on

Code nodes have distinct built-in shapes and colors that any configured style overrides, and the Graph view and block header can show or hide them.

### Over the cap

When `all` mode yields more elements than the element cap, the result falls back to a table with a notice.

### Hidden by header

A `code: hide` header line removes code nodes and their edges from a block's graph while keeping the rest.
