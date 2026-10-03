## Context

The repo is greenfield: only `lat.md/` design notes and OpenSpec scaffolding exist. Motivation is in proposal.md; architecture decisions already agreed are in `lat.md/` (architecture, edge-syntax, graph-model, query-engine, visualization, roadmap). Constraints: the plugin must run in Obsidian desktop and mobile, `core` must not import Obsidian APIs (the later sidecar reuses it), and the vault is never written to.

## Goals / Non-Goals

**Goals:**
- A `core` package that turns note text and frontmatter into a graph and runs a Cypher subset, testable without Obsidian.
- A `plugin` package that feeds `core` from the vault and renders results.
- A query interface narrow enough that a Ladybug backend can implement it later.

**Non-Goals:**
- Schema notes, edge embeds, Ladybug, vectors, sidecar (see proposal.md).
- Full openCypher conformance; only the subset in the cypher-query spec.
- Replacing or patching the core graph view.

## Decisions

**Monorepo with npm workspaces: `packages/core`, `packages/plugin`.** `core` is plain TypeScript with no DOM or Obsidian imports, enforced by a lint rule. Alternative: a single package with folders, rejected because the boundary would erode and the sidecar needs a clean import.

**Parser is a hand-written line scanner plus a small property-block parser.** The scanner skips fenced code and matches `[+-]?type:: [[target]] {…}`; the property block is a tolerant JSON5-like parser (unquoted keys, numbers, booleans, strings). Alternative: regex only, rejected because nested braces and quotes break it; alternative: a parser generator, rejected as heavy for one line form. Malformed blocks degrade to "edge without props plus a diagnostic".

**Graph store is plain maps keyed by node path and edge ID, with per-file contribution tracking.** Each file records the nodes and edges it contributes so a change removes and re-adds only those. Stubs are reference-counted by incoming edges. Alternative: rebuild everything on change, rejected for large vaults.

**Node identity is the note path; link targets resolve through the host.** `core` takes a resolver function (link text to path or null), which the plugin backs with Obsidian's link resolution. This keeps `core` pure and makes stub creation a resolver miss.

**Cypher engine is a hand-written lexer, recursive-descent parser and pattern-matching executor over the store.** MATCH expands patterns edge by edge with label and type filters applied early; WHERE is an expression tree evaluated per binding row. Alternative: embed an existing JS Cypher parser, rejected after weighing the cost of tracking its quirks against a small subset; revisit when the subset grows. Writes are rejected at parse time, so the executor never mutates.

**Query interface: `run(query) -> { columns: {name, kind}[], rows }`.** Values are node refs, relationship refs or scalars. This is the contract a Ladybug backend must also satisfy, and the renderer depends only on it.

**Renderer is Cytoscape.js with a style sheet built from a type-to-style map.** One `GraphRenderer` component serves both inline blocks and the Graph view leaf. Negative edges use a dashed red style and positive a solid one, always with a text label so meaning does not rely on color alone. Tables are plain DOM.

**Live refresh listens to the metadata cache and re-indexes the changed file, then notifies subscribed blocks with a debounce.** Blocks subscribe only while visible. Alternative: poll, rejected as wasteful.

**Sign is a +1/-1 polarity from the type prefix, separate from `weight`.** This is an assumption recorded in proposal.md because the product question is still open; it is cheap to change since sign lives in one parser step and one property.

## Risks / Trade-offs

- [Hand-written Cypher parser drifts from real openCypher] -> keep the subset small and documented, add a table of accepted and rejected queries as tests, and plan a conformance suite against Ladybug in v0.3.
- [Obsidian metadata cache does not expose body lines for edges] -> the plugin reads note text for changed files itself; cost is bounded by only re-reading changed files.
- [Large vaults slow initial indexing] -> index in batches yielding to the UI, show progress, and persist nothing in v0.1 so correctness comes first.
- [Cytoscape performance past a few thousand elements] -> element cap with table fallback (graph-query-block spec); scope queries rather than swap renderer.
- [Derived edge IDs shift when duplicates are reordered] -> accepted for v0.1; pinned IDs are honored, warnings come in v0.2.
- [Mobile limits] -> `core` has no Node APIs; verify the plugin loads on mobile before release.

## Open Questions

- Final sign semantics (polarity versus weight-derived) can change without altering the query or rendering contracts.
- Which Graph Link Types settings, beyond the inline-field syntax, must be honored for compatibility.
- Precedence between per-type defaults, block headers and settings once schema notes arrive in v0.2.
