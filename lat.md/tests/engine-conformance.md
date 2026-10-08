---
lat:
  require-code-mention: true
---
# Engine Conformance Tests

Test specifications for the cross-engine suite that keeps the built-in engine and the Ladybug backend in agreement, described in [[query-engine#Two backends]].

## Both engines run the corpus

Every corpus query runs on both engines over the fixture vault and none ends in an unclassified divergence.

## Differences registry in lock-step

Every documented difference is exercised by a corpus query, every cited difference exists, and none is stale.

## Recorded built-in expectations

The built-in results match the expectations recorded in the corpus, also when Ladybug comparisons are skipped.

## Writes rejected on both

`CREATE` is rejected as read-only on both engines and neither the graph nor the mirror changes.

## Corpus covers the subset

Every clause, pattern feature, operator, function and aggregate in the parser's exported tables appears as a parsed construct (not a substring) in at least one corpus query.

## Fixture coverage

The fixture has multi-label nodes, stubs, positive and negative edges, a pinned id, parallel edges and edge properties.

## Unordered rows compare as sets

Without a final `ORDER BY`, rows compare as a multiset.

## Order matters under ORDER BY

With a final `ORDER BY`, row order must match; ordering inside `WITH` alone does not count.

## Column kinds must agree

Different column names or kinds, or an error on only one engine, are divergences.

## Unexpected divergence fails

An undocumented divergence is reported with both results; documented ones classify as expected differences; counts are summarized per outcome.

## Registry entries checked

A documented difference without a query, one that no longer diverges, and a citation of an unknown difference are each reported.

## Report printed with counts

`runCorpus` prints a report with one line per query, both results for each divergence, and the counts per outcome.

## Write clauses in the corpus

The corpus holds `CREATE`, `MERGE`, `SET`, `DELETE` and `REMOVE` queries, each recorded and observed as `readonly` on both engines.

## Expected difference must match its nature

A cited difference excuses a divergence only when each engine produced the outcome the registry documents for it; other divergences and unknown citations fail.
