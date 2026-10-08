# lat-vault-integration Specification

## Purpose
Defines how a lat.md folder lives inside a vault and how vault content is exported to and imported from the lat.md format.

## Requirements

### Requirement: Read in place
The system SHALL read a `lat.md/` folder inside the vault, at the vault root or nested below it, without modifying any of its files, and SHALL resolve nested-heading and code links through the lat resolver. A link to a source target SHALL be reported to the user with its file and symbol and SHALL NOT open or create a note.

#### Scenario: Nested heading link
- **WHEN** a note links `[[architecture#Monorepo layout#core]]`
- **THEN** the plugin opens that section and the files stay byte-identical

#### Scenario: Code link
- **WHEN** a note links `[[src/config.ts#getConfigDir]]`
- **THEN** the plugin reports the source target `src/config.ts#getConfigDir` and does not open or create a note

#### Scenario: Nested lat.md folder
- **WHEN** the lat.md folder is `docs/lat.md/` inside the vault and a note links `[[architecture#Monorepo layout]]`
- **THEN** the link opens that section of `docs/lat.md/architecture.md`

### Requirement: Export projection
The system SHALL export a vault subset to a lat-conformant folder, flattening typed edges to plain links, dropping edge properties and normalizing links, and SHALL verify the result with the same rules as `tg check`.

#### Scenario: Typed edge flattened
- **WHEN** a note has `knows:: [[Bob]] {since: 2020}`
- **THEN** the exported file links `[[Bob]]` without the property block and the report lists the loss

#### Scenario: Valid output
- **WHEN** export finishes
- **THEN** `lat check` and `tg check` both pass on the output

### Requirement: Loss report
The system SHALL report every construct dropped or flattened by export as a count per kind with examples, and SHALL state that round trip is not guaranteed.

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

### Requirement: Ambiguous lat links
When a lat link's short id matches several sections, the plugin SHALL list the candidates to the user and SHALL NOT open any of them.

#### Scenario: Two candidates
- **WHEN** a note links `[[Overview]]` and both `lat.md/cli.md` and `lat.md/sidecar.md` have an `Overview` section
- **THEN** the plugin shows both candidate ids and opens nothing

### Requirement: lat.md findings in plugin diagnostics
The plugin SHALL report broken links and leading-paragraph violations of an in-vault lat.md folder in its diagnostics list, and SHALL leave index-file and source-code checks to `tg check`.

#### Scenario: Broken lat link listed
- **WHEN** `lat.md/cli.md` links `[[architecture#Missing]]`
- **THEN** the plugin diagnostics list that link with its file and line
