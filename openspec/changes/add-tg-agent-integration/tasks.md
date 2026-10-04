## 1. Init and generation

- [ ] 1.1 Implement `tg init` with scaffold, managed block and dry-run diff
- [ ] 1.2 Detect and migrate an existing lat block
- [ ] 1.3 Implement `tg gen` for agents.md, claude.md and cursor-rules.md

## 2. Hooks

- [ ] 2.1 Implement `tg hook` for Claude Code prompt and stop events
- [ ] 2.2 Install hooks into agent settings behind `--write`

## 3. MCP

- [ ] 3.1 Serve the six lat-equivalent tools over stdio
- [ ] 3.2 Add `cypher` and `edges` tools using the shared result contract

## 4. Skills

- [ ] 4.1 Ship a docs-maintenance skill and a graph-query skill and install them with `init`

## 5. Tests

- [ ] 5.1 Write tests covering every scenario in the tg-agent-integration spec

## 6. Sync

- [ ] 6.1 Document in lat.md/cli, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
