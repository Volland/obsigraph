## Context

Obsidian resolves `[[file#Heading]]` but not nested `#Heading#Sub` and knows nothing about code targets. Rewriting a user's lat.md files to suit Obsidian would break lat tooling.

## Goals / Non-Goals

**Goals:** the same folder works in Obsidian and in `tg`; export gives a valid lat.md folder with clear loss reporting; import is safe.

**Non-Goals:** lossless round trip, two-way sync, rewriting files in place.

## Decisions

**Handlers, not rewrites.** The plugin intercepts clicks and hovers for lat ids and resolves them with the shared resolver; files stay byte-identical.

**Export is a projection with a report.** It lists every dropped or flattened construct (typed edge to plain link, property blocks dropped, embeds expanded to text) so the loss is visible. It validates the result with the same `check` before finishing.

**Import copies by default and mounts by option.** Mounting is a symlink or a configured extra folder, never a move.

**Export refuses to overwrite** a non-empty target without `--force`.

## Risks / Trade-offs

- [Users expect round trip] -> docs and the export report state the loss plainly.
- [Handlers break on Obsidian updates] -> use public link-click and hover APIs only.
