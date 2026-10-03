# Query Engine

Queries are written in openCypher inside `graph-query` blocks and run through one interface backed by two engines.

## Two backends

The default engine is an in-plugin TypeScript interpreter over the live graph; an optional desktop-only LadybugDB backend takes the same query text.

Both are read-only. A conformance suite runs each query against both engines so they cannot silently diverge.

## Supported subset

The in-plugin engine supports `MATCH`, `WHERE`, `RETURN`, `ORDER BY` and `LIMIT` first, then aggregations, `WITH`, `OPTIONAL MATCH` and variable-length paths.

The exact clause and function list is to be pinned down and documented; unsupported clauses must fail with a clear error pointing at the Ladybug backend.

## Query block

A `graph-query` fenced block holds a header (`view`, columns, styling) followed by the Cypher text.

The result shape picks the renderer unless the header overrides it: nodes, relationships or paths render as a graph, scalars as a table. Blocks re-run live on note changes, debounced. See [[visualization]].
