## MODIFIED Requirements

### Requirement: Refs and expand
The system SHALL list the sections and code locations referencing a section with `tg refs [--scope md|code|md+code] <query>` (default `md+code`). With `tg expand [--stdin] [text]` it SHALL rewrite each `[[ref]]` to the canonical id of the section it locates and append a `<lat-context>` block giving, for each ref, the section id, its `file:start-end` location and the first line of its leading paragraph; with `--json` it SHALL print the rewritten text and the resolved refs instead. When any ref cannot be located, `tg expand` SHALL name it, ask the user to correct it and exit 1.

#### Scenario: Code reference listed
- **WHEN** a source file has `// @lat: [[tests#Login]]`
- **THEN** `tg refs tests#Login` lists that file and line

#### Scenario: Expand text
- **WHEN** `tg expand "see [[architecture#Source of truth]]"` runs
- **THEN** the link becomes `[[lat.md/architecture#Architecture#Source of truth]]` and a `<lat-context>` block lists `lat.md/architecture.md:<start>-<end>`

#### Scenario: Unknown ref
- **WHEN** `tg expand "[[zzz]]"` runs and no section name is close to `zzz`
- **THEN** it names `zzz`, asks the user to correct the reference and exits 1

## ADDED Requirements

### Requirement: Directory index files
The system SHALL require each directory in `lat.md/` that has children to have an index file `<dir>.md` listing every child as `- [[name]]` with a description, and `tg check` SHALL report a missing index file, a child missing from it and an entry for a file that does not exist, suggesting the listing to add.

#### Scenario: Child missing from the index
- **WHEN** `lat.md/tests/new.md` is added and `lat.md/tests/tests.md` does not list it
- **THEN** `tg check` reports `new` as missing from `tests.md`, shows the line to add and exits 1

### Requirement: Check JSON report
`tg check --json` SHALL print one JSON document holding `ok`, `findings`, `warnings`, the number of scanned files per extension and the elapsed time, and SHALL use the same exit codes as text output.

#### Scenario: JSON with findings
- **WHEN** `tg check --json` runs on a project with one broken link
- **THEN** stdout is one JSON document with `ok` false and that link in `findings`, and the exit code is 1
