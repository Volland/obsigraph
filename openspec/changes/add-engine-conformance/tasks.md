## 1. Fixture and corpus

- [ ] 1.1 Create the fixture vault covering multi-labels, stubs, signed edges, pinned ids, parallel edges and edge properties
- [ ] 1.2 Write the query corpus as data files covering every supported clause and function, ORDER BY cases and write-rejection queries

## 2. Runner

- [ ] 2.1 Implement the runner that executes each query on both engines and normalizes results
- [ ] 2.2 Implement comparison rules (names, kinds, row multiset, order only under ORDER BY)
- [ ] 2.3 Implement outcome classification and the report with both results shown for divergences
- [ ] 2.4 Implement recorded expectations and the skip path when Ladybug is unavailable

## 3. Differences registry

- [ ] 3.1 Create the intentional differences document with ids, construct, in-plugin behavior and Ladybug behavior
- [ ] 3.2 Cross-check registry against corpus: missing queries, uncited differences and stale entries fail the run
- [ ] 3.3 Add the supported-subset coverage check

## 4. Tests

- [ ] 4.1 Table tests for the comparison and classification logic covering every scenario in the engine-conformance spec
- [ ] 4.2 Run the suite against real LadybugDB and triage initial divergences

## 5. Sync

- [ ] 5.1 Link the differences list from lat.md/query-engine, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate add-engine-conformance --strict`
