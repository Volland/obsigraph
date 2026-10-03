## Why

LadybugDB adds full-language Cypher, algorithms and a vector index that the in-plugin engine lacks. To use it, the graph must be copied into it without ever making the database a second source of truth. See lat.md/ladybug-mirror.

## What Changes

- Add a one-way mirror from the in-memory graph to a LadybugDB database stored outside the vault content.
- Sync incrementally per changed file; support a full rebuild from markdown at any time.
- Preserve node labels, node properties, edge type, edge properties, `sign` and `id`, and the stub flag.
- Detect an out-of-date or incompatible database and rebuild it instead of trusting it.
- Never write from the database back into notes.

## Capabilities

### New Capabilities
- `ladybug-mirror`: A disposable, incrementally synced LadybugDB copy of the vault graph.

### Modified Capabilities

## Impact

- New mirror module and a desktop-only database adapter in `packages/plugin` (adapter) and `packages/core` (pure diff and mapping logic). Depends on `graph-model`. No query UI; the query backend is `add-ladybug-backend`.

## Assumptions

- LadybugDB is a community fork of Kuzu (MIT) with an embedded Cypher engine, a Node.js package (`@ladybugdb/core`), WebAssembly bindings and vector and full-text indices. Verified only from search summaries; not verified: exact Node API, behavior inside Obsidian's Electron renderer (native module loading), WASM feasibility on mobile, and vector index parameters.
- Kuzu-lineage databases need declared table schemas. Not verified how many distinct labels, multi-label nodes and open-ended edge properties can be modeled; design.md picks a generic storage model that does not depend on it.
- Mirror data lives in the plugin's own data directory, not in the vault's notes.
