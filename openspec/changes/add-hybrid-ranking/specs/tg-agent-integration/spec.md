## MODIFIED Requirements

### Requirement: MCP server
The system SHALL serve the tools `tg_locate`, `tg_section`, `tg_refs`, `tg_search`, `tg_retrieve`, `tg_expand`, `tg_check`, `tg_cypher` and `tg_edges` over stdio MCP with `tg mcp`, each marked read-only and sharing its implementation with the CLI command of the same name, and SHALL report the server name `tg` and the installed CLI version. Tools added by other capabilities, such as `tg_trace`, SHALL follow the same `tg_` naming.

#### Scenario: Cypher over docs and code
- **WHEN** an agent calls `tg_cypher` with a query over `Section` and `CodeSymbol` nodes
- **THEN** it receives the same `_type`-tagged result contract as the sidecar

#### Scenario: Tool names
- **WHEN** an MCP client lists the tools of `tg mcp`
- **THEN** every tool name starts with `tg_` and the list includes `tg_locate`, `tg_section`, `tg_refs`, `tg_search`, `tg_retrieve`, `tg_expand`, `tg_check`, `tg_cypher` and `tg_edges`

### Requirement: Prompt hook stays offline
The prompt-submit hook SHALL search the project lexically in memory only, SHALL NOT open, create or sync the graph store, and SHALL NOT run an embedding model or call any network service, even when one is configured.

#### Scenario: Provider configured
- **WHEN** `TG_EMBED_PROVIDER=openai` is set and a prompt-submit event arrives
- **THEN** the hook output includes lexical search hits and no network request is made

#### Scenario: No store yet
- **WHEN** a prompt-submit event arrives in a project with no `.tg/graph.lbug`
- **THEN** the hook answers and no store is created
