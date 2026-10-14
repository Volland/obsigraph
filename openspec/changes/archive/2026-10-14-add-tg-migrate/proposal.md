## Why

A team moving from lat.md to tg can run `tg init --migrate` today, but that only swaps the agent setup: the `CLAUDE.md` block, hooks and MCP entry. The docs stay exactly what lat.md made them — untyped files, plain wiki links, plain `@lat:` comments — so the project gets none of what tg adds: no `Decision` or `Constraint` sections to query, no `motivated_by` or `constrains` relations, no metadata on links, no `implements` or `verifies` edges from code. Converting a real lat.md folder by hand means reading every link, which nobody does, so the typed graph never appears.

## What Changes

- **`tg migrate`**, a CLI command that turns a lat.md project into an ontology-aware tg project in one pass, deterministically:
  - **Agent setup**: the same swap as `tg init --migrate` (lat block, hooks and MCP entry replaced), plus the tg skills, the OpenSpec guidance and the code ontology when they are missing.
  - **Types files** that have no `type:` by their path (`decisions.md`, `adr/` → `Decision`; `requirements.md` → `Requirement`; `tests/` → `Scenario`; `constraints.md`, `policies` → `Constraint`; `glossary.md` → `Concept`; `changes/` → `Change`), with a content fallback for requirement files written as SHALL sentences.
  - **Types links**: for each plain wiki link in a section, the candidate relations are the edge types the project ontology allows from the source section's type to the target's type. A candidate is applied only when the sentence containing the link carries one of its cue words (`because` → `motivated_by`, `replaces` → `supersedes`, MUST → `constrains`); `--infer` also applies a single candidate without a cue. Everything else is reported, not guessed. Negative edges and edges with an unrestricted endpoint need an explicit cue. The relation is written as a typed edge line in the section; the prose link stays.
  - **Adds metadata** the ontology declares for that edge type: `since` from the date the link was written (`git blame`), `strength` (`must` or `should`) from the sentence's MUST, SHALL or should, `level` from a test's path.
  - **Upgrades `@lat:` code comments** to typed `@tg:` edges when the target's type determines the relation (`implements` for a Requirement or Decision, `verifies` for a Scenario or a test call), with the same metadata; `--keep-lat` keeps the `@lat:` line for projects that still run `lat check`.
  - **Reports** every link it left plain (untyped end, no candidate, ambiguous) with its sentence and candidates, as text or `--json`, so a person or an agent can finish the job.
- Safe by default: writes like `tg init`, `--dry-run` prints the diff, refuses files with uncommitted changes unless `--force`, and a second run changes nothing.
- **`tg-migrate` skill** for Claude Code and the other agents: runs `tg migrate --dry-run --json`, applies it, then resolves the leftover links by reading their sentences — choosing the relation and its metadata (reasons, tickets, versions) from the text, splitting mixed files into typed sections where needed, never inventing a relation it cannot justify — and finishes with `tg check`, `tg ontology check` and `tg trace`.

## Capabilities

### New Capabilities
- `tg-migrate`: the `tg migrate` command: file typing, link typing, metadata, code reference upgrade, setup swap, safety and report.

### Modified Capabilities
- `tg-agent-integration`: a sixth bundled skill, `tg-migrate`.

## Impact

- `packages/cli/src/commands/migrate.mts` (new), `init.mts` (shared setup), `gen.mts` (skill).
- `packages/cli/templates/skills/tg-migrate/SKILL.md` (new).
- Tests, `lat.md/cli.md`, test specs, README, site docs, the comparison article.
