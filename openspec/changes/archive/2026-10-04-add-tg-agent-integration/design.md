## Context

Agent configs (`CLAUDE.md`, `.claude/settings.json`) are user-owned files. A tool that rewrites them silently destroys trust. The sidecar already serves a Cypher MCP tool whose contract can be shared.

## Goals / Non-Goals

**Goals:** one command to a working setup; safe, reviewable changes; migration from `lat`.

**Non-Goals:** supporting every agent, managing user settings beyond hooks, a GUI.

## Decisions

**Dry run by default.** `tg init` prints a unified diff; `--write` applies. Marker comments (`%% tg:begin %%` / `%% tg:end %%`) bound the managed block so re-running replaces only that block.

**Migration is explicit.** An existing `lat:begin` block is reported and replaced only with `--write --migrate`, rewriting `lat` command names to `tg`.

**MCP tools mirror CLI commands** one to one and share code, so there is one implementation per behavior. `cypher` returns the `_type`-tagged contract of the sidecar.

**Hooks never fail the agent:** `tg hook` exits 0 on internal errors and prints a note.

## Risks / Trade-offs

- [Agent hook schemas change] -> hook installation is isolated per agent behind a small adapter and covered by fixtures.
- [Cypher over a large code graph is slow] -> the query deadline and element cap from the engine apply.
