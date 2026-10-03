## Context

After the mirror and backend land, the engines accept the same query text but differ in implementation, typing and supported syntax. lat.md/query-engine states the suite exists so engines cannot silently diverge.

## Goals / Non-Goals

**Goals:** detect divergence automatically, keep documented differences honest, run in CI with or without Ladybug.

**Non-Goals:** performance benchmarking, fuzzing arbitrary queries (possible later), conformance with Neo4j or other openCypher engines.

## Decisions

**Corpus as declarative data files (query, optional tags, expected-difference id), fixture vault as committed markdown.** Easy to review and extend, shared by both engines. Alternative: queries inline in test code, rejected because the difference documentation must reference them.

**Comparison on normalized results: multiset of rows unless `ORDER BY`.** Matches Cypher semantics where unordered results have no defined order. Normalization covers numeric typing, null handling and graph-value identity (nodes by path, relationships by id).

**Differences registry is a single document with ids; the runner cross-checks it in both directions** (every entry has a query; every observed expected difference cites an entry; stale entries fail). This is what keeps the list from rotting. Alternative: a prose list only, rejected as it drifts.

**Recorded expectations for the in-plugin engine** let CI verify it when Ladybug is missing. Alternative: skip everything without Ladybug, rejected as it leaves the default engine unguarded.

**Corpus coverage check against the documented supported subset** ties into lat.md/query-engine's supported subset list.

## Risks / Trade-offs

- [Real divergences may be numerous at first] -> classify as expected differences with documented reasons or fix; do not weaken comparison rules.
- [Ladybug version upgrades change behavior] -> pin the version in CI and re-run the suite on upgrade.
- [Flaky ordering] -> only compare order under `ORDER BY`; tie-breakers in corpus queries.
