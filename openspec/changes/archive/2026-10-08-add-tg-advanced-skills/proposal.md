## Why

`tg init` installs two skills that cover writing lat.md and querying the section graph. Since 0.10.0 `tg` also traces OpenSpec requirements to code, tests and docs, but nothing teaches an agent to use that: it does not know to put `implements` above the code it writes for a task, `verifies` above the test that proves a scenario, to look up which requirements a file realizes before it edits it, or to run `tg trace` before archiving a change. OpenSpec ships its own skills and slash commands (propose, apply, archive, explore) that drive exactly those moments, and they know nothing about `tg`.

## What Changes

- Three new bundled skills, installed by `tg init` for Claude Code next to `tg-docs` and `tg-graph`:
  - `tg-trace`: spec-driven traceability with OpenSpec: requirement ids, `implements` and `verifies` annotations, frontmatter, `tg trace`, naming rules and CI.
  - `tg-impact`: before and after changing code, find the requirements, scenarios, tests and docs a file or symbol touches, and what to re-run.
  - `tg-audit`: audit specs against code requirement by requirement, classify drift as stale spec, code bug or open decision, and turn the result into an OpenSpec change and annotations.
- `tg-graph` documents `Requirement` and `Scenario` nodes and requirement queries.
- When OpenSpec's skills or commands exist (`.claude/skills/openspec-*/SKILL.md`, `.claude/commands/opsx/*.md`), `tg init` appends a managed block bounded by `<!-- tg:begin -->` and `<!-- tg:end -->` to the propose, apply, archive and explore ones, with the `tg` steps for that stage. Re-runs replace only the block, so `openspec update` followed by `tg init --write` restores it. `--no-openspec` skips the patch.
- `tg init --skills-only` writes only skills and OpenSpec patches, for projects that keep their own instruction files and hooks.
- `tg gen` prints every bundled skill and patch.

## Capabilities

### Modified Capabilities
- `tg-agent-integration`: more bundled skills, OpenSpec skill patching, skills-only init and new `gen` targets.

## Impact

- `packages/cli/templates/skills/` (three new skills, `tg-graph` updated), new `packages/cli/templates/openspec/`, `packages/cli/src/commands/init.mts` and `gen.mts`, tests in `packages/cli/test/agent.test.ts`.
- `lat.md/cli.md` Agent integration and `lat.md/tests/tg-agent.md`.
- This repository's own OpenSpec skills and commands get the block.
