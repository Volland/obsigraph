# Roadmap

Delivery is phased as thin end-to-end slices. v0.1 to v0.11 are shipped; from 0.12 the plan narrows to one wedge and moves through three gated phases.

## v0.1 usable core

Edge parser, graph model, a Cypher subset engine and `graph-query` blocks with table and graph rendering, plus the Graph view leaf.

Styling is a settings-level default per type; there are no schema notes yet. This phase carries most of the risk. Implemented and archived as five OpenSpec changes (edge-parsing, graph-model, cypher-query, graph-query-block, graph-view); the Obsidian shell still needs manual verification in a live vault.

## v0.2 typing and config

Done: add-schema-notes, add-visualization-config, add-edge-embeds, add-cypher-extensions. Schema notes, per-type visualization, `{{edge: ...}}` embeds, pinned IDs and warnings, and `WITH`, `OPTIONAL MATCH` and variable-length paths.

## v0.3 Ladybug

Done: add-sidecar-service, add-ladybug-mirror, add-ladybug-backend, add-engine-conformance, all inside the sidecar. The one-way [[ladybug-mirror|mirror]], the Ladybug backend behind the shared query interface, and the cross-engine conformance suite.

## v0.4 RAG

Done: add-embedding-provider, add-chunking-verbalization, add-vector-index, add-sidecar-mcp-graphrag. The embedding provider interface, chunking and edge verbalization, the vector index, and the [[sidecar]] with REST and MCP.

## v0.5 tg CLI

Built on branch `feat/tg-cli`, shipping as a single release: the `tg` CLI replacing lat.md, `@lat:` and `@tg:` annotations, an opt-in code layer in the graph, and lat.md vault integration with export. Designed in [[cli]].

Nine OpenSpec changes, built in dependency order (check-commands after annotations and the symbol provider, which it needs) but released together: add-tg-cli-core, add-tg-lat-resolver, add-tg-check-commands, add-tg-symbol-provider, add-tg-annotations, add-tg-search, add-tg-agent-integration, add-tg-code-layer and add-tg-vault-integration. All nine are implemented and archived; the sidecar mirror of code nodes, a task of add-tg-code-layer, is deferred. Gate: `tg check` matches `lat check` on this repository and on real lat.md projects. Because it ships as one release, the parity suite runs in CI throughout the build.

## v0.6 VS Code extension

A VS Code extension with typed backlinks for notes and code, a graph webview and a `tg init` setup funnel, published to the VS Code Marketplace and Open VSX; designed in [[vscode]] and implemented by the OpenSpec change vscode-extension.

It first extracts two shared packages, `node-vault` and `graph-ui`, with sidecar and plugin behavior unchanged. Deferred: a query panel and symbol-level cursor tracking. Publishing needs the maintainer's registry tokens and a published `@typedgraph/cli` 0.5.0.

## Releases 0.6 to 0.11

Shipped between Oct 6 and Oct 8, 2026, after the VS Code extension: the open schema spec, OKF and SHACL interop, the ontology gallery, typed note creation and OpenSpec traceability. Details are in `CHANGELOG.md`.

- 0.6: OKF compatibility, markdown link targets in edges, `tg export --format okf` and `tg okf check` ([[okf]]).
- 0.7: Typed Graph Schema 0.1, edge types, templates and SHACL export and import ([[shacl]]).
- 0.8: the code ontology in `tg init` and the ontology gallery.
- 0.9: TGS 0.2 with id rules and template tokens, the new typed note menu and the Zettelkasten ontology. It broke the gallery ontology for existing users.
- 0.10: `tg trace` from OpenSpec requirements to code, tests and docs.
- 0.11: the `tg-trace`, `tg-impact` and `tg-audit` skills, and tg-aware OpenSpec skills.

## Assessment

As of Oct 8, 2026 the product is technically deep but has almost no outside users, so features are pushed rather than pulled. The plan below responds to five gaps.

Traction: 5 GitHub stars, 0 forks, 0 issues; about 423 npm downloads of `@typedgraph/cli` from Sep 5 to Oct 4; 3 downloads of the latest plugin release assets.

1. **Breadth ahead of adoption.** Seven surfaces (plugin, CLI, sidecar, VS Code extension, TGS spec, ontology gallery, website) and seven releases in five days, with no outside issues to steer them.
2. **"Agent memory" has no write path.** Every MCP tool of `tg mcp` and the [[sidecar]] is read-only. An agent can query its memory but cannot record a decision or an edge into it.
3. **Too many audiences.** `marketing/relaunch-plan.md` targets Obsidian users, agent developers, product engineers and AI coders: four funnels for one maintainer.
4. **Setup costs before value.** Traceability pays off only after code is annotated by hand with `@tg:` comments.
5. **Housekeeping debt.** The name is split across obsigraph, Typed Graph and TypeGraph (the site now serves from `typedgraph.org`, but the repository is still `obsigraph`), and the 0.9 ontology break has no migration notes.

## Focus

The wedge is "specs and docs that know where their code is" for teams building with AI: `tg`, OpenSpec traceability and a CI gate, where neither lat.md nor OpenSpec competes.

- **Primary audience:** developers using Claude Code, Cursor or Windsurf with OpenSpec or lat.md. They install from npm and work in pull requests.
- **Obsidian's role:** the human editor and viewer for the same graph, not a separate product line with its own funnel.
- **Frozen:** new hosts and note formats, until Phase 1 ships and outside users exist.

## Phase 1 close the loop

Planned for 0.12 to 0.13, about two to three weeks. Agents can write to the graph, and traceability appears in the pull request.

| Feature | What it is | Why |
| --- | --- | --- |
| Agent write tools | MCP tools `tg_record` (a decision, constraint or concept as a typed note) and `tg_link` (a typed edge), each with a dry run returning a diff | Makes the memory claim true; writes stay plain Markdown reviewed in the PR |
| `tg validate` | The open OpenSpec change add-tg-validate: schema, edge and embed diagnostics outside Obsidian, with SARIF output | Schema checks in CI and GitHub code scanning |
| GitHub Action `typedgraph/check` | Runs `tg check`, `tg trace --gaps` and `tg validate`; comments on the PR with the requirements the diff touches and coverage it lost | Visible to every reviewer, so it spreads inside teams |
| `tg impact --since <ref>` | The `tg-impact` skill as a deterministic CLI command | One call for the Action and the editors |
| Housekeeping | Finish the rename (repository, README links, extension display name); migration notes for the 0.9 ontology change | Credibility before the launch push |

Gate: the Action runs green on this repository and on one outside project, and an agent records a decision through MCP that a human merges.

## Phase 2 lower the entry cost

Planned for 0.14 to 0.16, about one month. It cuts the time from install to the first useful trace, now blocked by annotating code by hand.

| Feature | What it is | Why |
| --- | --- | --- |
| `tg init --infer` | Proposes `@tg: implements` annotations by matching OpenSpec requirements and lat.md sections to symbols, as a reviewable change | Value on an existing repo on day one |
| Coverage dashboard | `tg trace --html`: a static page per capability showing implemented, tested and documented, published from CI | Something to link in a README or show a manager |
| Editor help | Autocomplete of edge types and targets from the schema in VS Code and Obsidian, and inline `tg validate` diagnostics | Lowers the syntax barrier |
| Cypher gaps | `UNWIND`, `CASE` and `shortestPath` in the built-in engine ([[query-engine#Supported subset]]) | Fewer queries need the sidecar |

Gate: a new user gets a first useful `tg trace` on an existing repository in under 10 minutes, measured with at least three outside testers.

## Phase 3 grow the Obsidian side

Planned for 0.17 and later. Once the developer wedge works, it brings in Obsidian users who already write `key:: value` fields.

| Feature | What it is | Why |
| --- | --- | --- |
| Dataview, Breadcrumbs and Juggl import | Converts their fields and queries to typed edges and Cypher, with a report of what did not convert | Dataview already uses `key:: value`: "Dataview fields with meaning" |
| Embeddings in the plugin | On demand after a first CLI iteration, see below | Semantic search on mobile without the [[sidecar]] |
| AsciiDoc notes | The open OpenSpec change asciidoc-notes | Parked until an outside user asks for it |

Gate: the GitHub Action has steady outside users before anything under Later starts.

### Embedded search in two steps

Revised Oct 9, 2026: only a first iteration ships now; the rest of [[embedded-search]] waits for demand, since it serves the Phase 3 audience and does not move the Phase 1 or 2 gates.

Now: improve-tg-search-ranking, a few days inside today's in-memory `tg search`: an exact-identifier tier, section chunks for vectors, a similarity floor and a ranking evaluation with lat.md as reference. Later, when Phase 2's `tg init --infer` needs a local model or Obsidian users ask for semantic search: add-embedded-graph-store, add-local-embedding and add-hybrid-ranking, then add-plugin-search once the mobile spike passes, converge-sidecar-vectors last. No new host or note format is added, so the freeze holds.

## Later

A hosted MCP endpoint for team repositories and vaults, a read-only graph and trace behind a GitHub app, is the obvious paid tier. It starts only after the Phase 3 gate.

## Operating rules

For the next quarter, every feature answers an outside request or fixes a step in the funnel, and progress is tracked weekly against the Oct 8, 2026 baseline.

- **Cadence:** release weekly or every two weeks, not several times a day.
- **Freeze:** no new host or note format until Phase 1 ships.
- **Checkpoint:** if outside issues are still at 0 after the launch push, fix onboarding before adding features.

| Metric | Baseline (Oct 8, 2026) | Source |
| --- | --- | --- |
| npm downloads of `@typedgraph/cli` | about 423 a month | npm downloads API |
| Obsidian plugin installs | not yet measured | Community directory page |
| GitHub stars | 5 | GitHub |
| Issues opened by outside users | 0 | GitHub |
| Repositories running the Action | 0, not built yet | GitHub code search |

## Open questions

Sign semantics (v0.1 assumes prefix-only polarity) and exact Graph Link Types compatibility beyond the inline-field form remain unresolved. The v0.1 Cypher subset is pinned in [[query-engine#Supported subset]]; config precedence is settled in [[visualization#Styling]].

The `@typedgraph` npm scope is in use (`@typedgraph/cli` 0.11.0 is published); see [[cli#Packaging]]. The site and spec are served from `typedgraph.org`; whether a `typedgraph` GitHub organization and social handles are available is still unchecked.
