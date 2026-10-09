## Purpose

Defines the vector pack: synced, content-addressed files of vectors that let several devices share embeddings of the same vault without conflicts.

## ADDED Requirements

### Requirement: Content-addressed files
The system SHALL store vectors in one file per note version under a directory named by the model fingerprint, SHALL name each file by a hash of the fingerprint and the note's unit text hashes, and SHALL store per unit its text hash and a float16 vector after a header holding a format marker, the fingerprint, the dimension and the unit count.

#### Scenario: Same note on two devices
- **WHEN** two devices embed the same note text with the same fingerprint
- **THEN** both write a file with the same name

### Requirement: Pack location
The plugin SHALL keep the pack under `.obsidian/plugins/typed-graph/vectors/` so the user's sync service copies it, and the CLI SHALL use a pack only when `TG_VECTOR_PACK` names a directory.

#### Scenario: CLI default
- **WHEN** `tg search` runs with no `TG_VECTOR_PACK`
- **THEN** no pack is read or written

### Requirement: Read before embedding
The vector phase SHALL take a unit's vector from the pack when a file for the active fingerprint holds that unit's text hash, and SHALL embed only units the pack lacks.

#### Scenario: Phone after laptop
- **WHEN** a laptop embedded the vault and the pack synced to a phone with the same model
- **THEN** the phone fills its store from the pack and embeds no unit

### Requirement: Tolerant reading
Readers SHALL ignore files whose names do not match the pack naming pattern, such as sync conflict copies, and files whose header fingerprint differs from their directory.

#### Scenario: Conflict copy
- **WHEN** a sync service created `ab12… (conflict).tgv`
- **THEN** the reader skips it and reports no error

### Requirement: Append-only writes and pruning
Devices SHALL only add pack files, never rewrite them; pruning SHALL delete files of the active fingerprint that no current note references at most once a day, and SHALL delete directories of other fingerprints one week after a model switch.

#### Scenario: Edited note
- **WHEN** a note is edited and the next pruning runs
- **THEN** the file for its previous version is deleted and the file for its new version remains

### Requirement: Pack can be turned off
The plugin SHALL offer a setting to stop reading and writing the pack.

#### Scenario: Pack disabled
- **WHEN** sharing embeddings is turned off
- **THEN** no file is written under the pack directory and indexing embeds every unit locally
