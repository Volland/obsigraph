## Purpose

Defines how `tg` plugs into coding agents: setup, instruction generation, hooks, an MCP server and skills, without silently editing user files.

## ADDED Requirements

### Requirement: Safe init
The system SHALL print a diff of every file `tg init` would create or change and SHALL apply changes only when `--write` is given.

#### Scenario: Dry run
- **WHEN** `tg init` runs without `--write`
- **THEN** a diff is printed and no file is modified

#### Scenario: Idempotent write
- **WHEN** `tg init --write` runs twice
- **THEN** the second run changes nothing

### Requirement: Migration from lat
The system SHALL detect an existing lat.md instruction block and, only with `--write --migrate`, replace it with a tg block that uses `tg` command names.

#### Scenario: Existing block detected
- **WHEN** `CLAUDE.md` contains a `lat:begin` block
- **THEN** `tg init` reports it and states how to migrate

#### Scenario: Migration applied
- **WHEN** `tg init --write --migrate` runs
- **THEN** the lat block is replaced by a tg block and text outside the markers is untouched

### Requirement: Instruction generation
The system SHALL print agent instruction text for `agents.md`, `claude.md` and `cursor-rules.md` with `tg gen`.

#### Scenario: Generate
- **WHEN** `tg gen claude.md` runs
- **THEN** it prints instructions telling the agent to run `tg search` before work and `tg check` after

### Requirement: Agent hooks
The system SHALL handle agent hook events through `tg hook` and SHALL exit 0 even when an internal error occurs, printing a note instead.

#### Scenario: Prompt hook
- **WHEN** a prompt-submit event arrives
- **THEN** the hook output tells the agent to search first and expands any `[[refs]]` in the prompt

#### Scenario: Internal failure
- **WHEN** the project cannot be read
- **THEN** the hook exits 0 with a note and does not block the agent

### Requirement: MCP server
The system SHALL serve `locate`, `section`, `refs`, `search`, `expand`, `check`, `cypher` and `edges` over stdio MCP, sharing implementations with the CLI commands.

#### Scenario: Cypher over docs and code
- **WHEN** an agent calls `cypher` with a query over `Section` and `CodeSymbol` nodes
- **THEN** it receives the same `_type`-tagged result contract as the sidecar

### Requirement: Bundled skills
The system SHALL ship a docs-maintenance skill and a graph-query skill and install them with `tg init --write`.

#### Scenario: Skills installed
- **WHEN** `tg init --write` runs for Claude Code
- **THEN** both skills exist under the project's skills directory
