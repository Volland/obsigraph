## Purpose

Defines the `tg` executable: how it finds a project, how it reports results, and how it is packaged, so every later command behaves uniformly in terminals, hooks and CI.

## ADDED Requirements

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
The system SHALL exit 0 on success, 1 when a command reports findings, and 2 on usage or internal errors, and SHALL print machine-readable JSON instead of text when `--json` is given.

#### Scenario: Findings
- **WHEN** `tg check` finds a broken link
- **THEN** it exits with code 1

#### Scenario: JSON output
- **WHEN** `tg locate Foo --json` runs
- **THEN** stdout is a single JSON document and nothing else

### Requirement: Single bundled package
The system SHALL ship as one npm package `@typedgraph/cli` exposing the `tg` binary, with no runtime dependency on other published packages and no native or WASM modules.

#### Scenario: Clean install
- **WHEN** a user runs `npx @typedgraph/cli --version` on a machine with only Node installed
- **THEN** the version prints without installing anything else
