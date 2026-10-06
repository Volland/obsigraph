# okf-compat Specification

## Purpose
Defines how a vault is exported to an Open Knowledge Format (OKF v0.2) bundle and how a folder is checked for OKF conformance.

## Requirements

### Requirement: OKF export projection
The system SHALL export vault notes to an OKF v0.2 bundle in which every wikilink becomes a bundle-absolute markdown link, typed edge lines keep their type, sign and properties, and the source vault is unchanged.

#### Scenario: Typed edge kept as prose
- **WHEN** a note has `knows:: [[Bob]] {since: 2020}` and Bob is `People/Bob.md`
- **THEN** the exported note has `knows:: [Bob](/People/Bob.md) {since: 2020}`

#### Scenario: Round trip
- **WHEN** the exported bundle is loaded into a graph
- **THEN** it has the same typed edges (type, sign, target, properties) as the vault

#### Scenario: Unresolved link
- **WHEN** a note links `[[Missing Note]]`
- **THEN** the export writes a markdown link to `/Missing%20Note.md`, which OKF allows as not-yet-written knowledge, and the report counts it

### Requirement: Concept frontmatter
The system SHALL give every exported concept a non-empty string `type`, and a `title` and `description` when they are missing, without rewriting other frontmatter.

#### Scenario: Missing type
- **WHEN** a note has no frontmatter
- **THEN** the exported note has `type: Note` (or the `--default-type` value), a title and a description

#### Scenario: List type
- **WHEN** a note has `type: [Person, Employee]`
- **THEN** the exported note has `type: Person` and `types` listing both

### Requirement: Reserved filenames and index files
The system SHALL rename notes that use the reserved names `index.md` or `log.md` and rewrite links to them, and SHALL generate an `index.md` in every directory, with `okf_version` frontmatter only at the bundle root.

#### Scenario: Reserved note renamed
- **WHEN** the vault has a note `Projects/index.md`
- **THEN** it is exported as `Projects/index-note.md` and links to it point there

#### Scenario: Index generated
- **WHEN** export finishes
- **THEN** every directory has an `index.md` listing its concepts with their descriptions and its subdirectories

### Requirement: OKF change report
The system SHALL report every added or changed construct by kind, and SHALL verify the output with the OKF check.

#### Scenario: Report shown
- **WHEN** a vault with untyped notes and embeds is exported
- **THEN** the report counts default types and expanded embeds, and the output passes `tg okf check`

### Requirement: OKF conformance check
The system SHALL report as errors a non-reserved markdown file without parseable frontmatter, a missing, empty or non-string `type`, frontmatter in a non-root `index.md` or keys other than `okf_version` in the root one, and a `log.md` date heading that is not `YYYY-MM-DD`; it SHALL report broken links and missing `title` or `description` as warnings only.

#### Scenario: Conformant bundle
- **WHEN** every concept has a string `type`
- **THEN** `tg okf check` exits 0 even with broken links

#### Scenario: Missing type
- **WHEN** a concept's frontmatter has no `type`
- **THEN** `tg okf check` reports it and exits 1
