## MODIFIED Requirements

### Requirement: Project root discovery
The system SHALL locate the project root by walking upward from the working directory to the nearest directory containing `lat.md/`, `tg.md/` or `.tg/`, unless `--dir` is given.

#### Scenario: Run from a subdirectory
- **WHEN** `tg check` runs in `src/auth/` of a project whose root holds `lat.md/`
- **THEN** it checks that project root

#### Scenario: tg.md project
- **WHEN** `tg check` runs in `src/` of a project whose root holds `tg.md/` and no `lat.md/`
- **THEN** it checks that project root

#### Scenario: Explicit directory
- **WHEN** `tg --dir ../other check` runs
- **THEN** the project root is `../other` regardless of the working directory

#### Scenario: No project found
- **WHEN** no ancestor contains `lat.md/`, `tg.md/` or `.tg/`
- **THEN** the command exits with code 2 and a message suggesting `tg init`

## ADDED Requirements

### Requirement: Docs folder
The system SHALL read a project's documentation from `lat.md/` when that folder exists and from `tg.md/` otherwise, for every command, hook and MCP tool. Section ids SHALL start with the folder's name, the root index file SHALL be named after the folder (`lat.md/lat.md` or `tg.md/tg.md`), files under the docs folder SHALL NOT be scanned as source code, and messages SHALL name the folder in use.

#### Scenario: tg.md sections
- **WHEN** a project has `tg.md/tg.md` and `tg.md/auth.md` with a `## Login` heading and no `lat.md/`
- **THEN** `tg section auth#Login` prints the section with id `tg.md/auth#Auth#Login` and `tg check` reports no missing index

#### Scenario: lat.md wins
- **WHEN** a project has both `lat.md/` and `tg.md/`
- **THEN** every command reads `lat.md/` and ignores `tg.md/`
