---
lat:
  require-code-mention: true
---
# TG Agent Integration Tests

Test specifications for `tg init`, `gen`, `hook`, `mcp` and the bundled skills in `packages/cli`, one section per scenario of the tg-agent-integration spec. See [[cli#Agent integration]].

## Safe init

Nothing is written without consent.

### Dry run

`tg init` without `--write` prints a diff for every file it would create and leaves the project untouched.

### Idempotent write

Running `tg init --write` twice changes nothing the second time, and the hook entries are not duplicated.

## Migration from lat

Moving an existing lat.md setup.

### Existing block detected

A `lat:begin` block in `CLAUDE.md` is reported with the flag to migrate it, and stays untouched without `--migrate`.

### Migration applied

`--write --migrate` replaces the lat block with the tg block, swaps lat hooks and the lat MCP entry for tg ones, and leaves everything outside the markers byte-identical.

## Instruction generation

Printing agent instructions.

### Generate

`tg gen claude.md` prints instructions that say to run `tg search` first and `tg check` last, and an unknown target exits 2.

## Agent hooks

Behavior of `tg hook`.

### Prompt hook

The prompt hook emits the search-first reminder, expands `[[refs]]` in the user's prompt and appends the top lexical hits.

### Internal failure

Outside a project, or with unreadable input, a hook exits 0 and never blocks the agent.

## MCP server

The stdio server wraps the CLI.

### Cypher over docs and code

The server lists the eight tools and `tg_cypher` returns the same `_type`-tagged result contract as the sidecar for a query over `Section` nodes.

## Bundled skills

Skills shipped with the package.

### Skills installed

`tg init --write` for Claude Code creates the docs-maintenance and graph-query skills under `.claude/skills/`.
