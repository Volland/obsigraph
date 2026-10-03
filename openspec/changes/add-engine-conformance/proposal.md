## Why

Two engines accept the same query text, so they can silently diverge. A conformance suite makes divergence visible and keeps the intentional differences documented. See lat.md/query-engine#Two backends.

## What Changes

- Add a corpus of queries over a fixed fixture vault and a runner that executes each on both engines and compares results.
- Define comparison rules (column names and kinds, row sets, ordering only when `ORDER BY` is present, value normalization).
- Classify outcomes as match, divergence, expected difference, or skipped, and report them.
- Document the intentionally unsupported subset differences and keep the list in lock-step with the corpus so every listed difference is exercised.
- Fail the test run on any unclassified divergence; skip cleanly when Ladybug is unavailable.

## Capabilities

### New Capabilities
- `engine-conformance`: Cross-engine query conformance corpus, comparison rules, divergence report and documented subset differences.

### Modified Capabilities

## Impact

- New test and tooling code only; no runtime behavior change. Depends on `cypher-query`, `ladybug-mirror` and `ladybug-backend`. Updates lat.md/query-engine with the difference list.

## Assumptions

- Ladybug may be unavailable in CI; the suite then runs the in-plugin engine against recorded expected results and skips the Ladybug half, reporting the skip.
- Null ordering, integer versus float typing and list/map value forms are likely sources of divergence; unverified until run against a real Ladybug.
- The fixture vault is small and committed, covering labels, multi-labels, stubs, signed edges, pinned ids, parallel edges and edge properties.
