## MODIFIED Requirements

### Requirement: Incremental sync per changed file
The system SHALL, on each sync, diff the vault graph against the per-row content signatures stored with the mirror and apply only the node and edge rows that differ, covering notes added, modified, renamed and deleted and edges in untouched notes whose targets resolve differently, and SHALL NOT rewrite rows whose signature is unchanged.

#### Scenario: Edge removed from a note
- **WHEN** a note drops one of its edges
- **THEN** that edge disappears from the mirror and the note's other edges are untouched

#### Scenario: Note renamed
- **WHEN** a note is renamed
- **THEN** the mirror node moves to the new path with its outgoing edges, and edges from other notes follow whatever the vault graph resolves (a stub when their link text still names the old note)

#### Scenario: Note deleted with incoming edges
- **WHEN** a note that other notes link to is deleted
- **THEN** the mirror node becomes a stub and incoming edges remain attached

### Requirement: Stale or incompatible mirror is rebuilt
The system SHALL record the mirror format version and an in-progress or complete sync state in a manifest, and on a format mismatch, a missing manifest, an interrupted sync or a database that fails to open SHALL discard the mirror and rebuild it rather than serve it.

#### Scenario: Format version changed
- **WHEN** the stored mirror format version differs from the current one
- **THEN** the mirror is rebuilt before any query uses it

#### Scenario: Interrupted sync
- **WHEN** a sync was interrupted so the mirror is partially applied
- **THEN** the next start detects it and rebuilds

#### Scenario: Corrupt database
- **WHEN** the mirror database files exist but cannot be opened
- **THEN** the sidecar discards them, rebuilds the mirror and keeps serving built-in queries meanwhile

## ADDED Requirements

### Requirement: Mirror storage layout
The mirror SHALL store every node in one `Node` table with its labels as a list and each edge type in its own relationship table, with one typed column per property name and value kind named `p_<name>_<kind>`, so pass-through Cypher can be written against a documented layout.

#### Scenario: Typed property columns
- **WHEN** `since` holds a number on one `knows` edge and a string on another
- **THEN** the `knows` table stores them in separate number and string columns for `since`

### Requirement: Mirror status reported
`GET /status` SHALL report the mirror's state (`disabled`, `unavailable`, `idle`, `syncing` or `failed`), its message, its node and edge counts, the time of the last completed sync and the number of rebuilds.

#### Scenario: Ready mirror
- **WHEN** the mirror has completed a sync of a vault with 10 notes
- **THEN** `GET /status` reports the mirror as `idle` with its node and edge counts and the last sync time
