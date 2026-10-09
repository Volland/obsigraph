## Purpose

Defines `tg retrieve` and the `tg_retrieve` MCP tool, which return a context pack for agents with the same contract as the sidecar's retrieve.

## ADDED Requirements

### Requirement: Retrieve command
`tg retrieve <question> [--depth 0..3] [--budget N] [--k N] [--type T]` SHALL seed with the ranking pipeline's lifted hits, expand the seeds' graph neighborhood breadth-first to the given depth, and return cited Chunks and connecting Facts within the text budget (default 16,000 characters), hits first and neighbors by distance.

#### Scenario: Retrieve with expansion
- **WHEN** `tg retrieve "how does sync handle renames" --depth 1` runs
- **THEN** the output holds Chunks from the hit sections and from sections one edge away, each cited with file, heading path, line range, score, role and distance

#### Scenario: Depth zero
- **WHEN** `--depth 0` is given
- **THEN** only Chunks of the seed nodes are returned

### Requirement: Same contract as the sidecar
The context pack SHALL use the sidecar's retrieve response shape, including the `truncated` flag and the untrusted-content notice, and SHALL be produced by one implementation in `core` shared with the sidecar and the plugin.

#### Scenario: Truncation flagged
- **WHEN** the budget cuts off Chunks
- **THEN** the result has `truncated: true`

### Requirement: Retrieve over MCP
`tg mcp` SHALL expose `tg_retrieve` with the same parameters and result as the command, marked read-only.

#### Scenario: Agent retrieves
- **WHEN** an agent calls `tg_retrieve` with a question
- **THEN** it receives the same context pack as `tg retrieve --json`
