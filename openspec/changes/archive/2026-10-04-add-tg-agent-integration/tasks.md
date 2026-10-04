## 1. Init and generation

- [x] 1.1 Implement `tg init` with scaffold, managed block and dry-run diff
- [x] 1.2 Detect and migrate an existing lat block
- [x] 1.3 Implement `tg gen` for agents.md, claude.md and cursor-rules.md

## 2. Hooks

- [x] 2.1 Implement `tg hook` for Claude Code prompt and stop events
- [x] 2.2 Install hooks into agent settings behind `--write`

## 3. MCP

- [x] 3.1 Serve the six lat-equivalent tools over stdio
- [x] 3.2 Add `cypher` and `edges` tools using the shared result contract

## 4. Skills

- [x] 4.1 Ship a docs-maintenance skill and a graph-query skill and install them with `init`

## 5. Tests

- [x] 5.1 Write tests covering every scenario in the tg-agent-integration spec

## 6. Sync

- [x] 6.1 Document in lat.md/cli, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
