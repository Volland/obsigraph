## Purpose

Defines how markdown changes reach a graph store silently and incrementally on every host: a fast structural phase that keeps graph and full-text search current, and a lazy vector phase that never blocks it.

## ADDED Requirements

### Requirement: Two-phase sync
The system SHALL sync a store in two phases: the structural phase SHALL apply the difference between the current graph and the store's signatures to nodes, edges and searchable text in one transaction and refresh the affected full-text indexes; the vector phase SHALL fill missing vectors from a queue. The structural phase SHALL NOT wait for the vector phase.

#### Scenario: Edit becomes searchable before embedding
- **WHEN** a note is edited and the vector phase has not run yet
- **THEN** a full-text search finds the new text

#### Scenario: Incremental equals rebuild
- **WHEN** a store is synced incrementally through a sequence of edits, renames and deletions
- **THEN** its content equals a store built from scratch for the final vault

### Requirement: Shared diff
The structural phase SHALL use one diff implementation in `core` on every host, computed from content signatures of nodes, edges and searchable units.

#### Scenario: Untouched file with re-resolved target
- **WHEN** a note is created whose name an existing link in an unchanged note now resolves to
- **THEN** the edge in the unchanged note is updated to point at the new note

### Requirement: Live sync in the plugin
The plugin SHALL run the structural phase after the existing debounced vault change notification, including for files written by a sync service, and SHALL persist the store after each structural transaction.

#### Scenario: File arrives from another device
- **WHEN** a sync service writes a changed note into the vault while Obsidian is open
- **THEN** the store reflects the change after the debounce

### Requirement: Catch-up after downtime
Each host SHALL compare recorded file modification time, size and content hash with the corpus when it opens a store, hash only files whose time or size differ, and sync the changed files before answering.

#### Scenario: Files changed while closed
- **WHEN** three notes changed while Obsidian or the CLI was not running
- **THEN** the first search after start reflects all three

### Requirement: CLI catches up before reading
`tg search`, `tg retrieve` and `tg cypher` SHALL catch up the store before answering, and the prompt and stop hooks SHALL NOT open or sync the store.

#### Scenario: Hook stays fast
- **WHEN** the prompt-submit hook runs in a project whose store is missing
- **THEN** it answers from in-memory lexical search and creates no store

### Requirement: Freshness reported
Search results and status SHALL report how many searchable units are waiting for vectors and whether the structural phase is behind.

#### Scenario: Pending vectors shown
- **WHEN** 42 units have text but no vector
- **THEN** the search result and status say 42 items are waiting for embeddings
