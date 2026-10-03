## Why

The v0.1 engine covers `MATCH`, `WHERE`, `RETURN`, `ORDER BY` and `LIMIT`. Real questions need grouped counts, optional relationships, chained stages and multi-hop reachability. See lat.md/query-engine (Supported subset).

## What Changes

- Add `WITH` for staged queries, `OPTIONAL MATCH`, variable-length relationship paths and the aggregations `count`, `sum`, `avg`, `min`, `max`, `collect`.
- Grouping follows openCypher: non-aggregated return or with items are grouping keys.
- Assumptions: new behavior is a separate capability `cypher-extensions` (the `cypher-query` change is not archived yet, so nothing is modified in place); once both are archived, the `cypher-query` scenario that names `OPTIONAL MATCH` as unsupported is superseded and an unsupported-clause scenario should use another clause; variable-length paths default to a hard maximum depth of 10 when the upper bound is unbounded (`*`), configurable; relationships are not reused within one path; `DISTINCT` is included for aggregations only if already supported by the base engine, otherwise unsupported with a clear error.

## Capabilities

### New Capabilities
- `cypher-extensions`: `WITH`, `OPTIONAL MATCH`, variable-length paths and aggregations on top of the read-only subset.

### Modified Capabilities

## Impact

- Parser and evaluator in `packages/core`; renderers unchanged apart from path and aggregate result shapes already handled by shape detection.
- Depends on `cypher-query`. Independent of schema and embed changes.
