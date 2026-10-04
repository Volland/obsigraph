## Context

`core` is free of Obsidian and heavy dependencies and must stay that way. lat.md uses remark; here the parser is a small line-based heading scanner that skips fenced code and frontmatter, matching what edge parsing already does.

## Goals / Non-Goals

**Goals:** same section ids and verdict inputs as lat.md on real projects; incremental re-parse per file; usable from plugin and sidecar.

**Non-Goals:** full CommonMark fidelity, rendering, rewriting files.

## Decisions

**Line scanner, not a markdown AST.** Headings, fences and frontmatter are all that ids need. A full parser was rejected for bundle size and for diverging from the edge parser's tolerance.

**Resolution returns a tagged result** (`section`, `file`, `code`, `ambiguous`, `missing`) so `check`, the plugin and the graph builder share one function and no caller re-implements fallbacks.

**Short ids resolve by unique file name**, matching lat. Ambiguity is a result, never a guess.

**Differences are explicit.** Any intentional divergence from lat.md is listed in a differences file and asserted by tests.

## Risks / Trade-offs

- [Subtle id normalization differences (case, punctuation)] -> the differential suite in add-tg-check-commands runs both tools on real projects.
- [Setext headings] -> unsupported at first; reported as a warning if present in a lat.md folder.
