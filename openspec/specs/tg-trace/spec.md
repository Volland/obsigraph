# tg-trace Specification

## Purpose
Defines how `tg` reads OpenSpec requirements and traces them to the code that implements them, the tests that verify them and the lat.md files that explain them.

## Requirements

### Requirement: OpenSpec reader
The system SHALL read every `openspec/specs/<capability>/spec.md` under the project root, and the ADDED and MODIFIED requirements of every `openspec/changes/<change>/specs/<capability>/spec.md` except under `changes/archive/`, into an index of requirements with their scenarios, file and line.

#### Scenario: Main spec
- **WHEN** `openspec/specs/tg-check/spec.md` has `### Requirement: Check` with two `#### Scenario:` headings
- **THEN** the index holds requirement `Check` of capability `tg-check` with status `active` and both scenarios

#### Scenario: Active change
- **WHEN** `openspec/changes/add-x/specs/tg-x/spec.md` has `## ADDED Requirements` with `### Requirement: Y`
- **THEN** the index holds `Y` of `tg-x` with status `pending` and change `add-x`

#### Scenario: No openspec folder
- **WHEN** the project has no `openspec/` folder
- **THEN** the index is empty and no command fails because of it

### Requirement: Requirement ids
The system SHALL resolve `openspec:<capability>#<requirement>` and `openspec:<capability>#<requirement>#<scenario>` case-insensitively with whitespace collapsed, preferring a main-spec requirement over a pending one, and SHALL suggest the closest id when a target does not resolve.

#### Scenario: Scenario id
- **WHEN** a target is `openspec:TG-check#check#clean PROJECT`
- **THEN** it resolves to scenario `Clean project` of requirement `Check`

#### Scenario: Misspelled requirement
- **WHEN** a target is `openspec:tg-check#Chek`
- **THEN** it does not resolve and the suggestion is `openspec:tg-check#Check`

### Requirement: Docs frontmatter
The system SHALL read an `openspec:` list in a lat.md file's frontmatter, each entry a capability or `capability#requirement`, as `references` edges from the file's root section to the named requirements.

#### Scenario: Capability entry
- **WHEN** `lat.md/cli.md` has `openspec: [tg-check]` in frontmatter
- **THEN** its root section references every requirement of `tg-check`

### Requirement: Trace command
The system SHALL print, with `tg trace [capability...]`, each requirement's implementing code, verifying tests per scenario and explaining lat.md files, mark requirements that are unimplemented, unverified or undocumented, and support `--gaps` (only incomplete requirements), `--json` and `--strict`.

#### Scenario: Full trace
- **WHEN** a requirement has an `implements` annotation on a function and each scenario has a `verifies` annotation on a test
- **THEN** `tg trace` lists it as implemented and verified with those locations and exits 0

#### Scenario: Strict gap
- **WHEN** a scenario has no `verifies` edge and `tg trace --strict` runs
- **THEN** that scenario is listed as unverified and the exit code is 1

#### Scenario: Unknown capability
- **WHEN** `tg trace no-such-cap` runs
- **THEN** it reports the unknown name and exits 2

### Requirement: Requirement nodes
The system SHALL add `Requirement` and `Scenario` nodes with `contains` edges between them to the section graph used by `tg cypher`, `tg edges` and the MCP server, and annotation and frontmatter edges SHALL end at those nodes; the MCP server SHALL expose `tg_trace`.

#### Scenario: Cypher over requirements
- **WHEN** `tg cypher --code annotated "MATCH (s:CodeSymbol)-[:implements]->(r:Requirement) RETURN r.name"` runs on a project with one implements annotation
- **THEN** the requirement's name is returned
