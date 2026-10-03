---
lat:
  require-code-mention: true
---
# Cypher Extensions Tests

Test specifications for `WITH`, `OPTIONAL MATCH`, variable-length paths and aggregations in the built-in engine described in [[query-engine#Supported subset]].

## Filter on aggregate

`WITH a, count(b) AS n WHERE n > 2` passes only nodes with more than two matches to the next stage.

## Out-of-scope variable

A variable not carried by `WITH` is undefined afterwards, and non-variable `WITH` items must be aliased.

## Order and limit inside WITH

`ORDER BY` and `LIMIT` inside `WITH` restrict which rows continue to later clauses.

## Optional match yields null

Rows without an optional match are kept with the optional variables bound to null.

## Optional where keeps row

A `WHERE` after `OPTIONAL MATCH` filters only the optional part; rows whose candidates are all filtered stay with nulls.

## Bounded reachability

`*1..3`, `*2` and `*0..1` bounds return exactly the nodes reachable within those hop counts.

## Cycles terminate

Unbounded expansion over a cycle terminates and never repeats a relationship within one path.

## Unbounded depth is capped

Unbounded `*` stops at the configured depth cap and the result carries a notice; bounded ranges never add it.

## Path result

A path variable binds a path whose nodes and relationships alternate correctly, reported as a `path` column; `length(p)` counts relationships.

## Count per group

Non-aggregate items are grouping keys; `count(*)` counts rows and `count(DISTINCT x)` distinct values.

## Numeric aggregates

`avg`, `min`, `max` and `sum` over an edge property give one row for the whole match.

## Collect values

`collect` gathers values per group into a list.

## Empty input aggregates

Without grouping keys, zero rows yield `count` 0, `sum` 0, `avg`/`min`/`max` null and `collect` an empty list; with keys they yield no rows.

## Non-numeric sum

`sum` and `avg` over non-numbers fail naming the function and value type, and aggregates in `WHERE` are rejected.

## Aggregates are scalar columns

Aggregate and list columns are reported as scalars, so such results render as tables.

## Paths render as graphs

A block whose result holds paths draws their nodes and relationships as a graph, and a table cell shows a path as `A -type-> B -type-> C`.

## Still unsupported or read-only

Unsupported aggregate functions still fail by name, and writes after `WITH` are rejected as read-only.
