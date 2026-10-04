## Purpose

Defines the read and validate commands and the rule that `tg check` agrees with lat.md on whether a project is valid.

## ADDED Requirements

### Requirement: Locate and section
The system SHALL find sections by id or fuzzy name with `tg locate` and print a section with its content, outgoing and incoming references with `tg section`.

#### Scenario: Fuzzy locate
- **WHEN** `tg locate "Edge Syntax"` runs and a section has that title
- **THEN** it prints that section's id and file range

#### Scenario: Incoming references
- **WHEN** `tg section "graph-model#Nodes"` runs and another section links to it
- **THEN** the output lists that section under incoming references

### Requirement: Refs and expand
The system SHALL list sections and code locations referencing a section with `tg refs`, and replace `[[refs]]` in text with resolved locations with `tg expand`.

#### Scenario: Code reference listed
- **WHEN** a source file has `// @lat: [[tests#Login]]`
- **THEN** `tg refs tests#Login` lists that file and line

#### Scenario: Expand text
- **WHEN** `tg expand "see [[architecture#Source of truth]]"` runs
- **THEN** the link is replaced by its resolved file location

### Requirement: Check
The system SHALL report every broken wiki link, broken code reference, leading-paragraph violation and uncovered `require-code-mention` section, and SHALL exit 1 when any exist.

#### Scenario: Uncovered test spec
- **WHEN** a file with `require-code-mention: true` has a leaf section no code comment references
- **THEN** `tg check` reports that section and exits 1

#### Scenario: Clean project
- **WHEN** all links resolve and all rules hold
- **THEN** `tg check` prints a success line and exits 0

### Requirement: Parity with lat.md
The system SHALL produce the same set of findings as `lat check` on every fixture project in the parity suite, except for differences recorded as intentional.

#### Scenario: This repository
- **WHEN** both tools run over this repository's `lat.md/`
- **THEN** both report no findings

#### Scenario: Seeded breakage
- **WHEN** a fixture contains a broken link, an overlong leading paragraph and an uncovered spec
- **THEN** both tools report the same three findings
