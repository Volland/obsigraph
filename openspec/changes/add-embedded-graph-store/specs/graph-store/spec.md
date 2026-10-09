## Purpose

Defines the embedded graph store that every host keeps beside its corpus: one LadybugDB database holding the graph, its searchable text and its vectors, derived from markdown and safe to delete.

## ADDED Requirements

### Requirement: One store interface for every host
The system SHALL access the graph store only through a `GraphStore` interface in `core` offering open, schema execution, parameterized Cypher queries, transactions, close and drop, and SHALL provide drivers for the Ladybug WASM async build, the Ladybug WASM Node sync build and the native Ladybug build.

#### Scenario: Same query on two drivers
- **WHEN** the same vault is synced into a WASM store and a native store and the same Cypher query runs on both
- **THEN** both return the same rows

### Requirement: Builds per host
The plugin SHALL run the Ladybug WASM async build in a dedicated Worker, the CLI and the VS Code extension SHALL run the Ladybug WASM Node sync build, and the sidecar SHALL run the native build. User-facing hosts SHALL NOT need native binaries, network access or cross-origin isolation to open a store.

#### Scenario: CLI on a machine without network
- **WHEN** `tg cypher` runs with no network on a platform that has no native Ladybug binary
- **THEN** the store opens and the query answers

### Requirement: Indexes are available without installation
The system SHALL create vector and full-text indexes in WASM stores without any extension installation step, and the sidecar image SHALL contain the vector and full-text extensions at build time.

#### Scenario: Fresh CLI store
- **WHEN** a CLI store is created for the first time with no network
- **THEN** its full-text indexes exist and can be queried

### Requirement: Shared schema module
Every host SHALL create its store from one schema module in `core`, which defines the node table, one relationship table per edge type with typed property columns, the empty placeholder relationship table and a store metadata table recording format version, build state, corpus kind, model fingerprint and per-file content hashes.

#### Scenario: Sidecar and CLI agree on layout
- **WHEN** the sidecar and the CLI each build a store for the same vault
- **THEN** both stores have the same tables and columns

### Requirement: Store location per host
The CLI SHALL keep its store at `.tg/graph.lbug` under the project root with `.tg/` ignored by a `.gitignore` inside it; the plugin SHALL keep its store in per-device browser storage keyed by vault and SHALL NOT write it inside the vault or the `.obsidian` folder; the sidecar SHALL keep it in its data directory.

#### Scenario: Plugin store not synced
- **WHEN** the plugin has built a store for a vault
- **THEN** no store file exists anywhere under the vault folder, including `.obsidian`

#### Scenario: Two vaults on one device
- **WHEN** two vaults with the plugin are opened on the same device
- **THEN** each has its own store and neither sees the other's nodes

### Requirement: Store is derived and rebuildable
The store SHALL be derived only from markdown, SHALL be rebuilt automatically when it is missing, its format version differs, or its metadata says a build was interrupted, and SHALL be dropped and rebuilt once when it fails to open; when the rebuild also fails the host SHALL keep working without the store and report the reason.

#### Scenario: Store deleted
- **WHEN** `.tg/graph.lbug` is deleted and `tg search` runs
- **THEN** the store is rebuilt and the search answers

#### Scenario: Corrupt store
- **WHEN** the store file is corrupt
- **THEN** it is discarded and rebuilt once, and if that fails the command still answers from the in-memory graph with a notice

### Requirement: Bounded memory
Every host SHALL open the store with an explicit buffer pool size, 64 MB by default and 32 MB in the plugin on mobile, overridable by setting or `TG_STORE_BUFFER_MB`.

#### Scenario: Default pool
- **WHEN** the CLI opens a store with no override
- **THEN** the buffer pool is 64 MB

### Requirement: Read-only queries
User queries against the store SHALL be read-only, rejecting `CREATE`, `SET`, `DELETE` and `MERGE`, as the mirror does.

#### Scenario: Write attempt
- **WHEN** a user query contains `CREATE`
- **THEN** it is rejected as read-only and the store is unchanged
