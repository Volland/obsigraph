## 1. Agents

- [x] 1.1 Agent table with ids, names, instruction file and skills folder; `--agent` accepts a comma-separated list and rejects unknown ids
- [x] 1.2 Detect agents from their folders, files and OpenSpec skill folders
- [x] 1.3 Checklist TUI (`Io.choose`) for agents with detected ones ticked; detected agents or Claude Code otherwise
- [x] 1.4 Parts (`instructions`, `hooks`, `skills`, `openspec`, `ontology`) from `--only`/`--skip`/older flags or a checklist; list files and confirm before writing in a terminal

## 2. Files

- [x] 2.1 Install bundled skills into every selected agent's skills folder, once per shared folder
- [x] 2.2 Patch OpenSpec skills in those folders and Claude Code's opsx commands
- [x] 2.3 Write `AGENTS.md` once for all AGENTS.md-based agents
- [x] 2.5 Write the ontology schema to `Types/code-types.md` with `template` links and the six notes in `Templates/`; note an old `ontology/code-types.md`
- [x] 2.4 Add `tg:` rules to an existing `openspec/config.yaml`, replacing only earlier tg rules and keeping comments

## 3. Tests and docs

- [x] 3.1 Tests for every new and changed scenario
- [x] 3.2 Update lat.md cli and test specs, site docs, and run `lat check`, `openspec validate --strict` and the suite
