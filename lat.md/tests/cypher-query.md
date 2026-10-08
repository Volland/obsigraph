---
lat:
  require-code-mention: true
---
# Cypher Query Tests

Test specifications for the built-in openCypher subset described in [[query-engine]], run against a small fixture vault with typed, signed edges and one stub.

## Typed traversal with filter

`MATCH (a:Person)-[r:knows]->(b) WHERE r.since > 2019 RETURN a, r, b` binds one row per matching edge with node and relationship values.

## Ordering and limit

`ORDER BY` sorts ascending or descending with nulls last when ascending, and `SKIP` and `LIMIT` bound the rows.

## Sign and id are queryable

`r.sign` filters negative edges, `r.id` returns the derived ID, and `n.stub` finds stub nodes.

## Write clauses rejected

`CREATE`, `MERGE`, `SET`, `DELETE`, `DETACH DELETE` and `REMOVE` fail with a read-only error before anything runs.

## Unsupported syntax named

Valid openCypher outside the subset (`UNWIND`, `UNION`, `CALL`, `CASE`, `=~`, list slicing, `shortestPath`, unsupported aggregates and unknown functions) fails naming the construct.

## Unsupported expression constructs named

List and pattern comprehensions, map projections, pattern predicates and `COUNT {}` or `EXISTS {}` subqueries fail as `unsupported` naming the construct, not as syntax errors.

## Variable-length relationship is a list column

A variable-length relationship variable such as `rs` in `-[rs:knows*1..2]->` is reported as a scalar column whose values are lists of relationships.

## Syntax errors have positions

Malformed queries and undefined variables fail as syntax errors carrying line and column.

## Column kinds reported

Each column is reported as node, relationship or scalar from the query itself, so kinds are known even when no rows match.

## Stubs included by default

Stub nodes appear in matches unless the query filters on `n.stub = false`.

## Expression semantics

Arithmetic, string predicates, three-valued logic, `IN`, parameters, functions, label predicates, inline property maps and `DISTINCT` follow openCypher rules.

## Undirected and multi-pattern matches

Undirected and incoming patterns, comma-separated patterns sharing variables, and relationship uniqueness within one MATCH behave as in openCypher.
