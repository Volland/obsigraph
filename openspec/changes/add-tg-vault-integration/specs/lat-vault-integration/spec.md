## Purpose

Defines how a lat.md folder lives inside a vault and how vault content is exported to and imported from the lat.md format.

## ADDED Requirements

### Requirement: Read in place
The system SHALL read a `lat.md/` folder inside the vault without modifying any of its files, and SHALL resolve nested-heading and code links through the lat resolver.

#### Scenario: Nested heading link
- **WHEN** a note links `[[architecture#Monorepo layout#core]]`
- **THEN** the plugin opens that section and the files stay byte-identical

#### Scenario: Code link
- **WHEN** a note links `[[src/config.ts#getConfigDir]]`
- **THEN** the link resolves to the code node rather than a stub

### Requirement: Export projection
The system SHALL export a vault subset to a lat-conformant folder, flattening typed edges to plain links, dropping edge properties and normalizing links, and SHALL verify the result with the same rules as `tg check`.

#### Scenario: Typed edge flattened
- **WHEN** a note has `knows:: [[Bob]] {since: 2020}`
- **THEN** the exported file links `[[Bob]]` without the property block and the report lists the loss

#### Scenario: Valid output
- **WHEN** export finishes
- **THEN** `lat check` and `tg check` both pass on the output

### Requirement: Loss report
The system SHALL print every construct dropped or flattened by export and SHALL state that round trip is not guaranteed.

#### Scenario: Report shown
- **WHEN** a subset containing property blocks and embeds is exported
- **THEN** the report counts each dropped construct by kind

### Requirement: Safe export target
The system SHALL refuse to overwrite a non-empty export target unless `--force` is given.

#### Scenario: Non-empty target
- **WHEN** the target folder already contains files
- **THEN** export exits with code 2 and changes nothing

### Requirement: Import
The system SHALL adopt an existing `lat.md/` into a vault by copy, or by mount when requested, and SHALL never move or delete the source.

#### Scenario: Copy
- **WHEN** `tg import ../project/lat.md` runs
- **THEN** the files are copied into the vault and the source is unchanged
