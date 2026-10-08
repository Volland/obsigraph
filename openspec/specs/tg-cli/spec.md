# tg-cli Specification

## Purpose
Defines the `tg` executable: how it finds a project, how it reports results, and how it is packaged, so every later command behaves uniformly in terminals, hooks and CI.

## Requirements

### Requirement: Project root discovery
The system SHALL locate the project root by walking upward from the working directory to the nearest directory containing `lat.md/` or `.tg/`, unless `--dir` is given.

#### Scenario: Run from a subdirectory
- **WHEN** `tg check` runs in `src/auth/` of a project whose root holds `lat.md/`
- **THEN** it checks that project root

#### Scenario: Explicit directory
- **WHEN** `tg --dir ../other check` runs
- **THEN** the project root is `../other` regardless of the working directory

#### Scenario: No project found
- **WHEN** no ancestor contains `lat.md/` or `.tg/`
- **THEN** the command exits with code 2 and a message suggesting `tg init`

### Requirement: Output and exit codes
The system SHALL exit 0 on success, 1 when a command reports findings or, for `locate`, `section`, `refs`, `search` and `edges`, when nothing matches, and 2 on usage or internal errors, and SHALL print exactly one machine-readable JSON document instead of text when `--json` is given, including when nothing matches.

#### Scenario: Findings
- **WHEN** `tg check` finds a broken link
- **THEN** it exits with code 1

#### Scenario: JSON output
- **WHEN** `tg locate Foo --json` runs
- **THEN** stdout is a single JSON document and nothing else

#### Scenario: No match
- **WHEN** `tg section "no-such#Section" --json` runs
- **THEN** stdout is one JSON document reporting no match and the exit code is 1

### Requirement: Single bundled package
The system SHALL ship as one npm package `@typedgraph/cli` exposing the `tg` binary, with no runtime dependency on other published packages and no native or WASM modules.

#### Scenario: Clean install
- **WHEN** a user runs `npx @typedgraph/cli --version` on a machine with only Node installed
- **THEN** the version prints without installing anything else

### Requirement: Cypher over the section graph
`tg cypher [--code off|annotated|all] "<query>"` SHALL run a read-only openCypher query over the project's section graph with a 10 second timeout, using code mode `annotated` unless `--code` or the `TG_CODE` environment variable sets another, SHALL print a table or, with `--json`, the `_type`-tagged result contract, and SHALL exit 2 with line and column on a syntax error and on an unknown code mode.

#### Scenario: Sections queried
- **WHEN** `tg cypher --json "MATCH (s:Section) RETURN s.id LIMIT 1"` runs in a project with sections
- **THEN** stdout is one JSON document with one row and the exit code is 0

#### Scenario: Syntax error
- **WHEN** `tg cypher "MATCH (s RETURN s"` runs
- **THEN** the error gives the line and column and the exit code is 2

### Requirement: List annotation edges
`tg edges [--type t] [--to section] [--file path]` SHALL list the `@lat` and `@tg` annotation edges from code with their source, type, sign, target and properties, filtered by edge type, a target substring and a source path prefix, and SHALL exit 1 when no edge matches.

#### Scenario: Filter by type
- **WHEN** a project has `implements` and `verifies` annotations and `tg edges --type verifies` runs
- **THEN** only `verifies` edges are listed

#### Scenario: Nothing matches
- **WHEN** `tg edges --type no_such_type` runs
- **THEN** no edge is listed and the exit code is 1

### Requirement: Help, version and usage errors
The CLI SHALL print its version with `--version` or `-V`, general usage with `--help` or `-h`, a command's usage with `tg <command> --help`, and SHALL exit 2 naming the problem for an unknown command, an unknown option or an option missing its value.

#### Scenario: Unknown command
- **WHEN** `tg frobnicate` runs
- **THEN** stderr names the unknown command and suggests `tg --help`, and the exit code is 2
