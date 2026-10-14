## MODIFIED Requirements

### Requirement: Read in place
The system SHALL read a `lat.md/` or `tg.md/` folder inside the vault, at the vault root or nested below it, without modifying any of its files, and SHALL resolve nested-heading and code links through the lat resolver. A link to a source target SHALL be reported to the user with its file and symbol and SHALL NOT open or create a note.

#### Scenario: Nested heading link
- **WHEN** a note links `[[architecture#Monorepo layout#core]]`
- **THEN** the plugin opens that section and the files stay byte-identical

#### Scenario: Code link
- **WHEN** a note links `[[src/config.ts#getConfigDir]]`
- **THEN** the plugin reports the source target `src/config.ts#getConfigDir` and does not open or create a note

#### Scenario: Nested lat.md folder
- **WHEN** the lat.md folder is `docs/lat.md/` inside the vault and a note links `[[architecture#Monorepo layout]]`
- **THEN** the link opens that section of `docs/lat.md/architecture.md`

#### Scenario: tg.md folder
- **WHEN** a note in `docs/tg.md/` links a nested heading
- **THEN** the plugin resolves it through the lat resolver as it does in a `lat.md/` folder
