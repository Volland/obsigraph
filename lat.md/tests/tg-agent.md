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

### Cursor init

`tg init --agent cursor --write` writes `.cursor/rules/tg.mdc` and no Cursor hook configuration; `tg hook cursor stop` is for manual hook setup.

## MCP server

The stdio server wraps the CLI.

### Cypher over docs and code

The server lists the eight tools and `tg_cypher` returns the same `_type`-tagged result contract as the sidecar for a query over `Section` nodes.

## Bundled skills

Skills shipped with the package.

### Skills installed

`tg init --write` for Claude Code creates the docs-maintenance and graph-query skills under `.claude/skills/`.

## Code ontology

The shared vocabulary that `tg init` installs.

### Ontology installed

`tg init --write` creates `lat.md/code-ontology.md` and the TGS schema `ontology/code-types.md`, lists the note in the lat.md index, `tg check` passes, and the schema exports to SHACL with six types, eleven edge types and no diagnostics.

### Ontology kept on re-run

An ontology note that already exists is never overwritten, so a project can edit its vocabulary and run `tg init` again.

### Ontology opt-out

`--no-ontology` writes neither the note nor the schema.

