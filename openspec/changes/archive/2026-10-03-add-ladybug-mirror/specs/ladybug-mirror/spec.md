## Purpose

Defines the one-way mirror that copies the vault graph into LadybugDB as a disposable cache, so the vault stays the only source of truth and the database can always be rebuilt.

## ADDED Requirements

### Requirement: One-way sync from vault to database
The system SHALL propagate graph state only from the vault graph to the mirror and SHALL NOT modify any note as a result of mirror contents or database operations.

#### Scenario: Database edited externally
- **WHEN** the mirror database is modified by an outside tool
- **THEN** no note changes, and the next sync or rebuild restores the mirror to match the vault

### Requirement: Mirror is a disposable cache
The system SHALL be able to delete and fully rebuild the mirror from markdown alone, and the rebuilt mirror SHALL be equivalent to an incrementally maintained one.

#### Scenario: Delete and rebuild
- **WHEN** the mirror database is deleted and a rebuild runs
- **THEN** it contains the same nodes and edges as the vault graph with no loss

#### Scenario: Incremental equals rebuild
- **WHEN** a sequence of note edits is synced incrementally and then a full rebuild runs
- **THEN** both mirrors hold identical nodes, edges and properties

### Requirement: Incremental sync per changed file
The system SHALL apply only the nodes and edges contributed by a changed note, covering add, modify, rename and delete, and SHALL NOT rewrite unaffected data.

#### Scenario: Edge removed from a note
- **WHEN** a note drops one of its edges
- **THEN** that edge disappears from the mirror and the note's other edges are untouched

#### Scenario: Note renamed
- **WHEN** a note is renamed
- **THEN** the mirror node reflects the new identity and edges to it still resolve

#### Scenario: Note deleted with incoming edges
- **WHEN** a note that other notes link to is deleted
- **THEN** the mirror node becomes a stub and incoming edges remain attached

### Requirement: Fidelity of labels and properties
The system SHALL mirror node labels, node properties including the stub flag, and each edge's type, user-defined properties, `sign` and `id` without change in value.

#### Scenario: Signed edge with properties
- **WHEN** a note has an edge with sign negative, a pinned id and a property `since`
- **THEN** the mirrored edge has the same type, sign, id and `since` value

#### Scenario: Multiple labels
- **WHEN** a note has frontmatter `type: [Person, Employee]`
- **THEN** the mirrored node carries both labels

#### Scenario: Parallel edges
- **WHEN** two edges of the same type connect the same pair of nodes
- **THEN** both exist in the mirror with their distinct ids

### Requirement: Stale or incompatible mirror is rebuilt
The system SHALL record the mirror format version and the plugin version that wrote it, and on mismatch, corruption or an interrupted sync SHALL discard it and rebuild rather than serve it.

#### Scenario: Format version changed
- **WHEN** the stored mirror format version differs from the current one
- **THEN** the mirror is rebuilt before any query uses it

#### Scenario: Interrupted sync
- **WHEN** a sync was interrupted so the mirror is partially applied
- **THEN** the next start detects it and rebuilds

### Requirement: Mirror is optional
The system SHALL run the mirror inside the sidecar only when LadybugDB is installed and the mirror is enabled, and SHALL otherwise keep the sidecar fully functional without it.

#### Scenario: Disabled by configuration
- **WHEN** the sidecar starts with the mirror disabled
- **THEN** no mirror database is created and built-in queries work

#### Scenario: Not installed
- **WHEN** the LadybugDB module cannot be loaded
- **THEN** status reports the mirror as unavailable with the reason and everything else works

### Requirement: Sync does not block queries
The system SHALL perform mirror builds and syncs in the background and SHALL expose mirror status as idle, syncing or failed with a message.

#### Scenario: Large initial build
- **WHEN** the first mirror build runs on a large vault
- **THEN** built-in queries keep answering and status shows syncing until completion

#### Scenario: Sync failure
- **WHEN** a sync step fails
- **THEN** status is failed with a message and the mirror is marked for rebuild
