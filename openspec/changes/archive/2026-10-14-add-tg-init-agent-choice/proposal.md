## Why

`tg init` is meant to set a project up for whichever coding agent the team uses, and to be a drop-in for lat.md. Today it falls short in three ways:

- It installs the five tg skills only for Claude Code (`.claude/skills/`). With `--agent agents` or `--agent cursor` no skills are written at all, and Codex, GitHub Copilot and OpenCode, which all read `SKILL.md` folders now, get nothing.
- It never asks which agent is in use. It silently assumes Claude Code, even in a repository that OpenSpec has already set up for Cursor or Codex. lat.md's own `init` asks with a checklist.
- It writes the code ontology's schema to `ontology/code-types.md`, but the Obsidian plugin, VS Code's New Typed Note and `tg validate` read schemas from `Types/`, so none of them see the types, and no templates exist for them.
- It patches OpenSpec's skills but not `openspec/config.yaml`, whose per-artifact `rules` OpenSpec injects into every proposal, spec, design and task list it generates. Without tg rules there, new changes come out without annotation and trace tasks, and the trace stays empty until someone remembers.

## What Changes

- `--agent` takes a comma-separated list from `claude`, `codex`, `cursor`, `github-copilot`, `opencode` and `agents`, the same ids OpenSpec uses.
- In a terminal, `tg init` is a small setup TUI: an arrow-key checklist of coding agents (detected ones ticked), a checklist of what to set up or update (agent instructions in `CLAUDE.md`/`AGENTS.md`/Cursor rules, Claude Code hooks and MCP, skills, OpenSpec, code ontology), the list of files, and a confirmation before writing. `--agent`, `--only`, `--skip` and `--yes` give the same choices to scripts; outside a terminal and with `--json` nothing is asked, detected agents (or Claude Code) and all parts are used, and `--write` is still required.
- Detection looks at each agent's folders and files, including the skill folders OpenSpec created.
- The bundled skills are installed into every selected agent's skills folder (`.claude/skills`, `.agents/skills` for Codex and generic agents, `.cursor/skills`, `.github/skills`, `.opencode/skills`), and OpenSpec skills found in those folders are patched there.
- When `openspec/config.yaml` exists, `tg init` adds tg rules for `proposal`, `specs`, `design` and `tasks`, each prefixed `tg:`, which teach OpenSpec to annotate what it generates: `implements` on code, `verifies` on tests, `openspec:` frontmatter on the lat.md docs, and a final `tg check` and `tg trace`. Later runs replace only those rules, and other rules, keys and comments are kept. `--no-openspec` skips it, and the file is never created.
- The code ontology's schema moves to `Types/code-types.md`, each type links a template note in `Templates/` (Decision, Requirement, Scenario, Constraint, Concept, Change), and an old `ontology/code-types.md` gets a note instead of being touched.
- Instruction files: Claude Code gets `CLAUDE.md`, Cursor gets `.cursor/rules/tg.mdc`, and the others share one managed block in `AGENTS.md`. Hooks and MCP registration stay Claude Code only.

## Non-goals

- MCP or hook registration for agents other than Claude Code.
- Remembering the selection in a config file; detection gives the same default on a re-run.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `tg-agent-integration`: agent selection, detection, per-agent skill folders, OpenSpec config rules; bundled skills, OpenSpec skill patching, skills-only init and Cursor init change accordingly.

## Impact

- `packages/cli/src/commands/init.mts`, `agents.mts`, `openspec-config.mts`, `src/tui.mts`: agents, detection, parts, checklist and confirmation, per-agent skills, config rules, ontology files.
- `packages/cli/templates/`: OpenSpec rules and the six type templates.
- `packages/cli/src/cli.mts`, `main.mts`: optional `ask` and `choose` on `Io`, present only in a terminal.
- Tests in `packages/cli/test/agent.test.ts`; `lat.md/cli.md` and the test specs; site docs.
