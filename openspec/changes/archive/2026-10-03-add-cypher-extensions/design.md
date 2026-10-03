## Context

The in-plugin interpreter is a hand-written TypeScript engine for a small subset. lat.md/query-engine lists aggregations, `WITH`, `OPTIONAL MATCH` and variable-length paths as the next step and requires both engines to share query text and results, enforced later by a conformance suite.

## Goals / Non-Goals

**Goals:** openCypher-faithful semantics for the listed features; guaranteed termination; clear unsupported errors.

**Non-Goals:** `UNWIND`, `UNION`, list comprehensions, shortest-path functions, writes, query planning or indexes.

## Decisions

**Staged pipeline evaluator.** Each clause transforms a stream of rows; `WITH` is a projection plus optional filter, order and limit, which also gives `RETURN` its aggregation machinery. Alternative, compiling to a join plan, was rejected as over-built for vault-sized graphs.

**Variable-length expansion is a depth-first walk with relationship-uniqueness.** This matches openCypher and guarantees termination on cycles. A default cap of 10 on unbounded `*` protects the UI; it is a setting and the result reports when it applied. Alternative, no cap, was rejected because dense vaults could freeze Obsidian.

**Grouping keys are the non-aggregate items.** Standard openCypher semantics, which keeps behavior identical on the Ladybug backend.

**New capability instead of modifying `cypher-query`.** The base change is unarchived, so a MODIFIED delta would fail on archive. Trade-off: one scenario in `cypher-query` (OPTIONAL MATCH named as unsupported) becomes stale on archive and must be updated then.

**Aggregation null handling follows openCypher.** Nulls ignored; empty-input results as in the spec.

## Risks / Trade-offs

- [Semantics diverging from Ladybug] -> add each scenario to the conformance suite when v0.3 lands.
- [Combinatorial blow-up in long paths] -> depth cap, relationship uniqueness and a row limit with a visible truncation notice.
- [Parser growth] -> keep clauses as separate parser modules with one test file each.
