## Context

First Obsidian-facing change. `core` is already complete for parsing, graph and queries. The plugin must work on desktop and mobile and never write to notes.

## Goals / Non-Goals

**Goals:** a renderer reusable by the Graph view and a block pipeline that is testable without Obsidian.

**Non-Goals:** the Graph view leaf, schema notes, per-block styling beyond `view` and `columns`.

## Decisions

**Block pipeline split into pure and impure parts.** Header parsing, renderer choice and element capping live in a pure module covered by unit tests; DOM and Obsidian code is a thin shell. Obsidian cannot run in CI here, so this maximizes verified behavior.

**One `GraphRenderer` over Cytoscape.js with a style sheet generated from a type-to-style map.** Negative edges are dashed red and positive solid, always with a text label so meaning does not depend on color. Alternative: Sigma.js, rejected for edge-label cost at expected scale.

**Live refresh via metadata-cache events, per-file re-index, debounce, visible blocks only.** Polling rejected as wasteful.

**Obsidian-backed resolver and text reading in the plugin shell.** The metadata cache supplies frontmatter and link resolution; body text of changed files is read by the plugin and handed to `core`.

## Risks / Trade-offs

- [Cannot launch Obsidian in this environment] -> unit-test everything pure, type-check against the `obsidian` typings, build the bundle, and flag manual verification of the shell as outstanding.
- [Cytoscape performance] -> element cap with table fallback.
- [Initial index on large vaults] -> batch and yield to the UI.
