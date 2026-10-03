## 1. Store and availability

- [x] 1.1 Define a mirror store interface (load state, apply diff, reset) with an in-memory fake for tests
- [x] 1.2 Implement the LadybugDB store: `Node` table, one relationship table per edge type created on first use, transactions, availability probe
- [x] 1.3 Keep a manifest (format version, in-progress/complete) and rebuild when missing, mismatched or interrupted

## 2. Mapping and sync

- [x] 2.1 Map graph nodes and edges to mirror rows with signatures preserving labels, properties, stub flag, sign, id and heading
- [x] 2.2 Diff the graph against the mirrored signatures and apply the difference in one transaction
- [x] 2.3 Run as a sidecar processor with coalesced background syncs and status (idle, syncing, failed)
- [x] 2.4 Configuration to disable the mirror and a full rebuild path

## 3. Tests

- [x] 3.1 Tests covering every scenario in the ladybug-mirror spec with the fake store
- [x] 3.2 Property test: random edit sequences synced incrementally equal a fresh rebuild
- [x] 3.3 Integration test against real LadybugDB, skipped when the module is unavailable

## 4. Sync

- [x] 4.1 Update lat.md/ladybug-mirror, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate add-ladybug-mirror --strict`
