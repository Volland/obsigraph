# Query Engine

Queries are written in openCypher inside `graph-query` blocks and run through one interface backed by two engines.

## Two backends

The default engine is an in-plugin TypeScript interpreter over the live graph; an optional desktop-only LadybugDB backend takes the same query text.

Both implement [[packages/core/src/cypher/engine.ts#QueryEngine]] and are read-only. A conformance suite runs each query against both engines so they cannot silently diverge.

## Supported subset

The in-plugin engine supports `MATCH`, `WHERE`, `RETURN`, `ORDER BY` and `LIMIT` first, then aggregations, `WITH`, `OPTIONAL MATCH` and variable-length paths.

Parsed by [[packages/core/src/cypher/parser.ts#parseQuery]] and executed by [[packages/core/src/cypher/exec.ts#execute]]. v0.1 supports exactly:

- Clauses: repeated `MATCH` with optional `WHERE`, `RETURN [DISTINCT]` (including `*`), `ORDER BY` (`ASC`/`DESC`), `SKIP`, `LIMIT`.
- Patterns: labels, inline property maps, directed, incoming and undirected relationships, type alternation `[:a|b]`, comma-separated patterns, relationship uniqueness per MATCH.
- Expressions: literals, lists, maps, `$params`, property and index access, label predicates `n:Label`, arithmetic, comparisons, `IN`, `STARTS WITH`, `ENDS WITH`, `CONTAINS`, `IS [NOT] NULL`, three-valued `AND`/`OR`/`XOR`/`NOT`.
- Functions: `id`, `type`, `labels`, `keys`, `properties`, `startNode`, `endNode`, string helpers, `size`, `coalesce`, conversions, numeric helpers, `head`, `last`, `reverse`.
- Built-in properties: `n.stub`, `r.id`, `r.sign`.

Write clauses fail as read-only; anything else outside this list fails as unsupported, naming the construct. Errors carry line and column.

## Query block

A `graph-query` fenced block holds a header (`view`, columns, styling) followed by the Cypher text.

The result shape picks the renderer unless the header overrides it: nodes, relationships or paths render as a graph, scalars as a table. Blocks re-run live on note changes, debounced. See [[visualization]].
