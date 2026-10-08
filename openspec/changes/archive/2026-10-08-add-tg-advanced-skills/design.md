## Context

OpenSpec generates its skills and commands per tool and regenerates them on `openspec update`, so any edit inside them is lost unless it can be reapplied. `tg init` already manages a block in `CLAUDE.md` with `%% tg:begin %%` markers and replaces only that block on re-runs.

## Decisions

**Append a managed block, never rewrite OpenSpec text.** The block goes at the end of the file, bounded by HTML comment markers (`<!-- tg:begin -->`, `<!-- tg:end -->`) because skills render as plain Markdown where `%%` would show. Re-runs replace the block in place. Text outside it is never touched, so OpenSpec's instructions stay authoritative and tg only adds steps.

**Match by stage, not by file name.** A skill or command is patched when its name says which stage it drives: `openspec-propose` or `opsx/propose.md`, `openspec-apply-change` or `opsx/apply.md`, `openspec-archive-change` or `opsx/archive.md`, `openspec-explore` or `opsx/explore.md`. Other OpenSpec files are left alone. Only Claude Code paths are patched in this version.

**Advanced skills are workflows, not references.** Each new skill is a procedure with the exact commands and queries to run, verified against the CLI, plus the rules that keep links stable (never rename a requirement or scenario once annotated). Reference material stays in `tg-docs` and `tg-graph`.

**Skills-only init** exists because projects like this one keep lat.md's own instruction block and hooks; they still want the skills and the OpenSpec patches.

## Risks / Trade-offs

- [OpenSpec renames its skills] → stage matching is a small table in `init.mts`; unknown files are skipped, never broken.
- [Block drifts from the tg version] → re-running `tg init --write` after upgrading refreshes every block.
