## Context

The in-memory graph (graph-model) is authoritative for derived data and already tracks per-file contributions. Ladybug must hold a copy so full-language Cypher can read it. The vault is the sole source of truth; see lat.md/ladybug-mirror and lat.md/architecture.

## Goals / Non-Goals

**Goals:** exact fidelity of labels, properties, sign and id; incremental per-file sync; rebuild is always safe; desktop-only with graceful absence.

**Non-Goals:** the query backend (add-ladybug-backend), vector index (v0.4), two-way sync (deferred), mobile support.

## Decisions

**Mirror driven by graph-model change events, applied as per-file diffs.** Each changed file yields the set of nodes and edges it contributes before and after; the mirror applies the delta in one transaction. Alternative: periodically snapshot and diff the entire graph, rejected as O(vault) per edit.

**Generic storage model: one node table with a label list and a JSON property column plus promoted core columns (path, title, stub); one relationship table with type, sign, id and JSON properties.** Kuzu-lineage engines require declared schemas, and labels and edge properties are open-ended user data. Alternative: one table per label and per edge type with typed columns, which gives native `MATCH (n:Person)` but needs DDL migrations when notes introduce new labels or properties. Trade-off: queries over the generic model must be translated (label predicates, property access) by the backend change. Assumption: this can be done, to be proven by the conformance suite; if it fails, revisit with per-label tables.

**Mirror stored in the plugin data directory with a manifest (format version, plugin version, sync state, completed flag).** The manifest is written "in progress" before a sync and "complete" after; a missing complete flag triggers rebuild. Alternative: trust database transactions alone, rejected because crash semantics inside Obsidian's renderer are unverified.

**Rebuild is the repair strategy for every anomaly.** No partial repair logic; simplicity over speed, justified because the mirror is derived data.

**Pure mapping and diff logic in `core`, database adapter behind a small interface in the plugin.** Allows testing with a fake adapter in CI where the native module may be unavailable.

## Risks / Trade-offs

- [Native module may not load in Obsidian's Electron] -> adapter behind an interface, availability probe at startup, clear unavailable state; flag for manual verification.
- [Generic storage model slows or complicates queries] -> conformance suite quantifies it; per-label tables are the fallback.
- [Large initial build] -> batching with yields and status reporting.
- [Mirror drift from a bug] -> incremental-equals-rebuild property test.
