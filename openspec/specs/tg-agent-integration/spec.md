# tg-agent-integration Specification

## Purpose
Defines how `tg` plugs into coding agents: setup, instruction generation, hooks, an MCP server and skills, without silently editing user files.

## Requirements

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
The system SHALL handle agent hook events through `tg hook` and SHALL exit 0 even when an internal error occurs, printing a note instead. `tg init` SHALL install hooks for Claude Code only; for Cursor it SHALL write rules, and `tg hook cursor stop` SHALL stay available for users who add it to their Cursor hook configuration themselves.

#### Scenario: Prompt hook
- **WHEN** a prompt-submit event arrives
- **THEN** the hook output tells the agent to search first and expands any `[[refs]]` in the prompt

#### Scenario: Internal failure
- **WHEN** the project cannot be read
- **THEN** the hook exits 0 with a note and does not block the agent

#### Scenario: Cursor init
- **WHEN** `tg init --agent cursor --write` runs
- **THEN** `.cursor/rules/tg.mdc` is written and no Cursor hook configuration is created

### Requirement: MCP server
The system SHALL serve the tools `tg_locate`, `tg_section`, `tg_refs`, `tg_search`, `tg_expand`, `tg_check`, `tg_cypher` and `tg_edges` over stdio MCP with `tg mcp`, each marked read-only and sharing its implementation with the CLI command of the same name, and SHALL report the server name `tg` and the installed CLI version. Tools added by other capabilities, such as `tg_trace`, SHALL follow the same `tg_` naming.

#### Scenario: Cypher over docs and code
- **WHEN** an agent calls `tg_cypher` with a query over `Section` and `CodeSymbol` nodes
- **THEN** it receives the same `_type`-tagged result contract as the sidecar

#### Scenario: Tool names
- **WHEN** an MCP client lists the tools of `tg mcp`
- **THEN** every tool name starts with `tg_` and the list includes `tg_locate`, `tg_section`, `tg_refs`, `tg_search`, `tg_expand`, `tg_check`, `tg_cypher` and `tg_edges`

### Requirement: Bundled skills
The system SHALL ship the skills `tg-docs` (docs maintenance), `tg-graph` (graph queries), `tg-trace` (OpenSpec traceability), `tg-impact` (change impact) and `tg-audit` (spec audit) and install all of them under `.claude/skills/` with `tg init --write` for Claude Code.

#### Scenario: Skills installed
- **WHEN** `tg init --write` runs for Claude Code
- **THEN** all five skills exist under the project's skills directory

### Requirement: Code ontology install
`tg init --write` SHALL install the code ontology guide `lat.md/code-ontology.md` and its schema `ontology/code-types.md` only when each is absent, SHALL list the guide in the `lat.md` index so `tg check` stays clean, and SHALL skip both with `--no-ontology`.

#### Scenario: Existing ontology kept
- **WHEN** `lat.md/code-ontology.md` exists with local edits and `tg init --write` runs
- **THEN** the file is unchanged

#### Scenario: Opt out
- **WHEN** `tg init --write --no-ontology` runs in a new project
- **THEN** neither `lat.md/code-ontology.md` nor `ontology/code-types.md` is created

### Requirement: Claude Code registration
For Claude Code, `tg init --write` SHALL register `tg hook claude UserPromptSubmit` and `tg hook claude Stop` in `.claude/settings.json` and an MCP server `tg` (`tg mcp`) in `.mcp.json`, preserving every other setting, hook and server, and with `--migrate` SHALL remove the `lat` MCP server.

#### Scenario: Other servers kept
- **WHEN** `.mcp.json` already defines a server `github` and `tg init --write` runs
- **THEN** `.mcp.json` defines both `github` and `tg`

### Requirement: Prompt hook stays offline
The prompt-submit hook SHALL search the project lexically only and SHALL NOT call an embedding provider or any other network service, even when one is configured.

#### Scenario: Provider configured
- **WHEN** `TG_EMBED_PROVIDER=openai` is set and a prompt-submit event arrives
- **THEN** the hook output includes lexical search hits and no network request is made

### Requirement: OpenSpec skill patching
When OpenSpec skills or commands for Claude Code exist, `tg init` SHALL append to each propose, apply, archive and explore skill or command a block bounded by `<!-- tg:begin -->` and `<!-- tg:end -->` with the `tg` steps for that stage, SHALL replace only that block on later runs, SHALL leave every other OpenSpec file and all text outside the block unchanged, and SHALL skip patching with `--no-openspec`.

#### Scenario: Skills patched
- **WHEN** `.claude/skills/openspec-apply-change/SKILL.md` and `.claude/commands/opsx/apply.md` exist and `tg init --write` runs
- **THEN** both end with a tg block that tells the agent to annotate code with `implements` and tests with `verifies`, and their original text is unchanged

#### Scenario: Re-run is stable
- **WHEN** `tg init --write` runs a second time
- **THEN** each patched file still holds exactly one tg block and no change is reported

#### Scenario: Regenerated skill
- **WHEN** OpenSpec regenerates a patched skill without the block and `tg init --write` runs again
- **THEN** the block is appended again

#### Scenario: Opt out
- **WHEN** `tg init --write --no-openspec` runs
- **THEN** no OpenSpec file changes

### Requirement: Skills-only init
`tg init --skills-only` SHALL write only the bundled skills and the OpenSpec patches, leaving instruction files, hooks, MCP configuration, `lat.md/` and the ontology untouched.

#### Scenario: Existing lat.md project
- **WHEN** a project with a lat.md instruction block runs `tg init --skills-only --write`
- **THEN** only files under `.claude/skills/` and `.claude/commands/` change

### Requirement: Skill text available
`tg gen` SHALL print every bundled skill and every OpenSpec patch block by name.

#### Scenario: Print a patch
- **WHEN** `tg gen openspec-apply.md` runs
- **THEN** it prints the block that `tg init` appends to the apply skill
