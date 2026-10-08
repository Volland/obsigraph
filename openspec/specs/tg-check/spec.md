# tg-check Specification

## Purpose
Defines the read and validate commands and the rule that `tg check` agrees with lat.md on whether a project is valid.

## Requirements

### Requirement: Locate and section
The system SHALL find sections by id or fuzzy name with `tg locate` and print a section with its content, outgoing and incoming references with `tg section`.

#### Scenario: Fuzzy locate
- **WHEN** `tg locate "Edge Syntax"` runs and a section has that title
- **THEN** it prints that section's id and file range

#### Scenario: Incoming references
- **WHEN** `tg section "graph-model#Nodes"` runs and another section links to it
- **THEN** the output lists that section under incoming references

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

### Requirement: Check
The system SHALL report every broken wiki link, broken code reference (including `openspec:` annotation targets and unknown entries in `openspec:` frontmatter), leading-paragraph violation and uncovered `require-code-mention` section, and SHALL exit 1 when any exist. Missing OpenSpec traceability SHALL NOT be a finding.

#### Scenario: Uncovered test spec
- **WHEN** a file with `require-code-mention: true` has a leaf section no code comment references
- **THEN** `tg check` reports that section and exits 1

#### Scenario: Clean project
- **WHEN** all links resolve and all rules hold
- **THEN** `tg check` prints a success line and exits 0

#### Scenario: Unknown frontmatter capability
- **WHEN** a lat.md file has `openspec: [no-such-cap]`
- **THEN** `tg check` reports the file and the unknown name and exits 1

#### Scenario: Untraced requirement
- **WHEN** a requirement has no `implements` annotation
- **THEN** `tg check` does not report it

### Requirement: Parity with lat.md
The system SHALL produce the same set of findings as `lat check` on every fixture project in the parity suite, except for differences recorded as intentional.

#### Scenario: This repository
- **WHEN** both tools run over this repository's `lat.md/`
- **THEN** both report no findings

#### Scenario: Seeded breakage
- **WHEN** a fixture contains a broken link, an overlong leading paragraph and an uncovered spec
- **THEN** both tools report the same three findings

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
