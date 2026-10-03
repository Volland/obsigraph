## 1. Adapter and availability

- [ ] 1.1 Define a database adapter interface (open, transact, query, close) and a fake in-memory implementation for tests
- [ ] 1.2 Implement the desktop LadybugDB adapter and an availability probe that reports unavailable on mobile or when not installed
- [ ] 1.3 Define the generic node and relationship storage layout and the manifest (format version, plugin version, completed flag)

## 2. Mapping and sync

- [ ] 2.1 Implement the pure mapping from graph nodes and edges to mirror rows preserving labels, properties, stub flag, sign and id
- [ ] 2.2 Implement per-file delta computation from graph-model change events covering add, modify, rename and delete
- [ ] 2.3 Apply deltas in one transaction per file and mark the manifest in progress and complete around syncs
- [ ] 2.4 Implement full rebuild, batched with UI yields, and rebuild on version mismatch, corruption or interrupted sync
- [ ] 2.5 Expose sync status (idle, syncing, failed with message) and a settings control to rebuild or delete the mirror

## 3. Tests

- [ ] 3.1 Table tests covering every scenario in the ladybug-mirror spec using the fake adapter
- [ ] 3.2 Property test: random edit sequences synced incrementally equal a fresh rebuild
- [ ] 3.3 Integration test against real LadybugDB gated on availability

## 4. Sync

- [ ] 4.1 Update lat.md/ladybug-mirror with storage model and sync design, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate add-ladybug-mirror --strict`
