## Why

The hooks and instruction block are what make lat.md feel automatic in Claude Code. A replacement needs `init`, hooks, generated instructions, an MCP server and skills, or users must wire everything by hand.

## What Changes

- `tg init` scaffolds or adopts `lat.md/`, writes the `CLAUDE.md`/`AGENTS.md` block, and installs Claude Code hooks (search on prompt, check on stop). It detects an existing `lat` block and offers to migrate it.
- `tg gen agents.md|claude.md|cursor-rules.md` prints instruction files.
- `tg hook <agent> <event>` is the entry point hooks call.
- `tg mcp` serves stdio MCP tools: `locate`, `section`, `refs`, `search`, `expand`, `check`, plus `cypher` and `edges` over the docs and code graph.
- Two bundled skills: maintaining the docs folder, and querying the graph with Cypher.
- Decision: every write is a dry run printing a diff unless `--write` is passed.
- Assumption: Claude Code, Codex and Cursor are the agents to support first.

## Capabilities

### New Capabilities
- `tg-agent-integration`: Init, generation, hooks, MCP server and skills.

### Modified Capabilities

## Impact

- New commands in `packages/cli`; skill and template files shipped in the package. Reuses the sidecar's `cypher_query` result contract.
- Modifies user files only with `--write`.
