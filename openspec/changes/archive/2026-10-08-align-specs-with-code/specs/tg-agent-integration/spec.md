## MODIFIED Requirements

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

## ADDED Requirements

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
