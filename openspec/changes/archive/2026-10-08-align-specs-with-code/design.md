## Context

The audit (per capability: requirement status, issues, unspecified behavior, contradictions with lat.md) found 40 requirements partial or drifted. Each claim below was re-checked against the code before classifying it. The repo now carries `@tg: implements::` and `@tg: verifies::` annotations of the form `[[openspec:<capability>#<Requirement>[#<Scenario>]]]`, so requirement and scenario names are load-bearing.

## Goals / Non-Goals

**Goals:** specs that describe the shipped behavior or name the bug; concrete, testable wording; current versions and tool names; specs for shipped features that had none; no broken `openspec:` annotation.

**Non-Goals:** fixing code, editing lat.md, specifying every minor detail the audit listed (only the most valuable one to three additions per capability), changing any other open change.

## Decisions

**Verdicts.** `spec-stale`: the code is the intended behavior (tested, documented in lat.md or released), so the requirement is MODIFIED. `code-bug`: the spec is right, it stays as is and the fix is a follow-up task. `mixed`: the stale part of the text is corrected in a MODIFIED delta and the remaining SHALL is enforced by a follow-up code fix. `decision-needed`: left unchanged and raised in the proposal's open questions.

**Names never change.** Every MODIFIED requirement keeps its header and all of its scenario names; scenarios are only added. The one REMOVED requirement (graph-ui "Plugin behavior preserved") has no annotation in the repo. node-vault-loader "Sidecar behavior preserved" is annotated, so it is MODIFIED into a testable read-only guarantee instead of removed.

**Archive order.** `add-tg-openspec-trace` also MODIFIES tg-annotations "Edge source". That change is implemented, so this delta is written on top of its version (it keeps the "Test call" scenario) and must be archived after it. The other open changes touch different requirements.

**Model mismatch.** sidecar-mcp-graphrag required an error, vector-index and lat.md a stale answer. The stale answer wins because it is documented and tested, but only when dimensions match; different dimensions must fail, which the code does not do yet (follow-up). The alternative is open question 2.

### Classification of partial and drifted requirements

| Capability | Requirement | Verdict | Reason |
|---|---|---|---|
| shacl-interop | Typed Graph annotations | spec-stale | Template body is exported as `tgs:templateBody`, as the published namespace defines; more `tgs:` terms exist. |
| shacl-interop | Layouts that cannot keep a template are reported | code-bug | `planImport` warns only for newly created notes; importing into an existing multi-type note drops the body silently. |
| lat-vault-integration | Read in place | spec-stale | Code links show the source target and open nothing, as lat.md and its test spec say; nested lat.md folders are supported. |
| vscode-extension | Configurable roots | spec-stale | Note-creation commands (0.8.0) write files; skipped folders come from `typegraph.ignore`; source files are read. |
| vscode-extension | Backlinks for source files | spec-stale | Works from `@lat`/`@tg` annotations only, on any note, opening the note file. |
| vscode-extension | Empty and unsupported states | mixed | Panel shows incoming edges only (wording fixed); files outside the roots get no distinct message (code). |
| vscode-extension | Graph webview | spec-stale | Expand is right-click or long-press and open is double-click, per lat.md; only three theme colors come from VS Code. |
| vscode-extension | Set up TypeGraph | mixed | Commands are `tg init --write` and the setup check is concrete (spec); the welcome-view link never shows because the tree always has a child (code). |
| cypher-query | Unsupported syntax fails clearly | mixed | "in this version" made concrete (spec); list comprehensions, map projections, pattern predicates and subqueries fail as syntax errors (code). |
| cypher-query | Result shape | code-bug | A variable-length relationship variable is reported as `relationship` although each value is a list. |
| cypher-extensions | Remaining unsupported syntax still fails clearly | spec-stale | Neither engine nor block points at Ladybug; lat.md only promises the construct is named. |
| engine-conformance | Divergences are reported and fail the run | code-bug | No report is printed, and `classify` accepts any divergence on a query that cites a documented difference. |
| engine-conformance | Write rejection conformance | code-bug | `corpus.json` has no write queries; only a separate hand-written CREATE test exists. |
| engine-conformance | Corpus grows with the supported subset | mixed | "documents as supported" pinned to the parser tables (spec); clauses and operators are a hand-written list matched by substring (code). |
| graph-query-block | Live refresh | spec-stale | Refresh delay setting (default 300 ms), visibility gating and in-place restyle are the implemented, concrete behavior. |
| graph-ui | Host-independent rendering | spec-stale | Same output holds for the same styler and theme; negative edges are dashed only by default. |
| graph-ui | Neighborhood view-state | spec-stale | Expanded nodes are kept by each host, not by the package. |
| ladybug-backend | Full Cypher for reads | mixed | `CALL`, `LOAD`, `USE` and four functions are refused by design (spec); constructs the built-in parser rejects as syntax errors never reach Ladybug (code). |
| ladybug-backend | Clear error when unavailable | code-bug | After the mirror was ready once, a failed sync is served silently; a failed first sync retries forever as not-ready. |
| ladybug-backend | Errors reported with position | spec-stale | Messages are prefixed `Ladybug: `, syntax errors may come from the built-in parser, timeouts map to 504. |
| ladybug-mirror | Incremental sync per changed file | spec-stale | Sync diffs per-row signatures of the whole graph, documented as intentional; rename scenario matches the test. |
| ladybug-mirror | Stale or incompatible mirror is rebuilt | mixed | The manifest holds format and state, not a plugin version (spec); a corrupt database is not detected (code). |
| ladybug-mirror | Mirror is optional | code-bug | A failure in `LadybugStore.open` or `LadybugMirror.open` throws out of `startSidecar`. |
| sidecar-mcp-graphrag | Bounded output | code-bug | No cap on total returned text; only neighbor and chunk counts are capped. |
| sidecar-mcp-graphrag | Degraded retrieval without vectors | mixed | Stale answers on mismatch, per lat.md (spec); retrieve has no stale flag and mismatched dimensions yield NaN scores (code). |
| vector-index | Mismatch blocks writes and offers rebuild | mixed | Rebuild is `POST /vectors/rebuild`, not a prompt (spec); different dimensions are compared anyway (code). |
| vector-index | Incremental update per file | spec-stale | Renaming a file re-embeds because the title is in the chunk context; folder moves do not. |
| vector-index | Combined vector and graph query | spec-stale | It is one request with a `then` query over `$hits`, REST only, not one Cypher query. |
| vector-index | Unavailable provider degrades gracefully | spec-stale | Queries cannot be embedded while the provider is down, so search answers 503 (the test asserts it). |
| embedding-provider | Provider failure reporting | code-bug | `checkVectors` accepts empty and ragged vectors. |
| tg-cli | Output and exit codes | code-bug | `section`, `refs` and `expand` print plain text under `--json` when nothing matches or a ref fails. |
| tg-check | Refs and expand | spec-stale | `expand` rewrites to the canonical id and appends a `<lat-context>` block; `refs --scope` exists. |
| tg-annotations | Edge source | spec-stale | The window counts from the end of the comment block and only `@tg:` fallbacks warn, matching lat.md for `@lat:`. |
| tg-annotations | Annotation validation | decision-needed | Schema advice functions exist but are never called (open question 1). |
| tg-search | Hybrid ranking | code-bug | No timeout on embedding requests, so an unresponsive provider hangs `tg search`. |
| tg-search | Key variable aliases | code-bug | `TG_EMBED_KEY_FILE` loses to `LAT_LLM_KEY` because precedence is by kind before family. |
| lat-resolver | Leading paragraph rule | spec-stale | Like lat.md (checked side by side), a paragraph after a code block counts and a list alone does not. |
| symbol-provider | Source walker | spec-stale | Exact skip rules (`.git`, `node_modules`, top-level dot entries, nested `.gitignore`). |
| code-layer | Queryable code nodes | spec-stale | `CodeFile` has no `kind`; `CodeSymbol` exposes more properties; `lines` differs by label. |
| code-layer | Visible on demand | spec-stale | A Graph view mode selector bound to the global setting; blocks show code unless `code: hide`. |

Counts: 20 spec-stale, 11 code-bug, 8 mixed, 1 decision-needed.

### Wording and version fixes in implemented requirements

| Capability | Requirement | Change |
|---|---|---|
| tgs-spec | Published specification, Namespace IRI, Versioning | TGS 0.2 current with 0.1 archived; `tgs:templateBody`, `tgs:edge`, `tgs:kind`, `tgs:default`; notes without `tgs` read as 0.1. |
| tg-agent-integration | MCP server | Tool names are `tg_*`; server name `tg` with the CLI version. |
| okf-compat | OKF conformance check | Warnings are broken links, missing description, wikilinks and the v0.1 `timestamp` key; `title` is not checked. |
| lat-vault-integration | Loss report | Counts per kind with examples, not every construct. |
| shacl-interop | Import SHACL into schema notes | `--layout auto` (default), `--schema-folder`, `--base`. |
| embedding-provider | Secrets stay out of the vault | The plugin never embeds; keys reach the sidecar and CLI through environment variables. |
| graph-view | Node type styling | Style precedence comes from visualization-config, not settings alone. |
| visualization-config | Edge type styling | Tee arrow and minus prefix are unconditional; only the dashed line can be overridden. |
| edge-embeds, schema-notes, visualization-config | Live refresh / Schema changes take effect live / Live style updates | "shortly" replaced by "in the vault index update that processes the change". |
| node-vault-loader | Sidecar behavior preserved | Migration criterion replaced by a checkable read-only guarantee (annotated, so kept). |
| graph-ui | Plugin behavior preserved | REMOVED: migration-only, not annotated. |

### Duplicated requirements

| Topic | Requirements | Canonical |
|---|---|---|
| Unsupported Cypher | cypher-query "Unsupported syntax fails clearly", cypher-extensions "Remaining unsupported syntax still fails clearly" | cypher-query; the extensions one only adds writes after `WITH`. |
| Read-only queries | cypher-query "Read-only", ladybug-backend "Read-only enforcement", engine-conformance "Write rejection conformance", cypher-extensions "Writes remain rejected" scenario | cypher-query for the built-in engine, ladybug-backend for Ladybug; engine-conformance only tests both. |
| Result kinds | cypher-query "Result shape", cypher-extensions "Result shapes", graph-query-block "Renderer chosen by result shape" | cypher-query for kinds, graph-query-block for rendering. |
| Negative edge drawing | visualization-config "Edge type styling", graph-ui "Host-independent rendering", graph-view "Edge presentation" | visualization-config. |
| Shared renderer | graph-ui "Host-independent rendering", graph-view "Shared renderer" | graph-ui. |
| Expanded nodes | graph-ui "Neighborhood view-state", graph-view "Click to expand" and "Expanded nodes lifecycle", vscode-extension "Graph webview" | graph-view for the Obsidian lifecycle, graph-ui for the shared computation. |
| Leading paragraph | lat-resolver "Leading paragraph rule", tg-check "Check" | lat-resolver for the rule, tg-check for reporting and exit codes. |
| Model mismatch | vector-index "Mismatch blocks writes and offers rebuild", embedding-provider "Mismatch never mixes vectors", sidecar-mcp-graphrag "Degraded retrieval without vectors" | vector-index for the index, sidecar-mcp-graphrag for tool answers. |
| Element cap | graph-query-block "Large results are bounded", code-layer "Visible on demand" "Over the cap" | graph-query-block. |
| Note creation | schema-notes "Create a note from a type", typed-note-creation | schema-notes for template choice and defaults; typed-note-creation for ids, tokens, placement and commands. |
| Live updates | graph-query-block "Live refresh", edge-embeds "Live refresh", schema-notes "Schema changes take effect live", visualization-config "Live style updates" | graph-query-block owns the Refresh delay; the others only require the same index update. |

## Risks / Trade-offs

- [Mixed and code-bug requirements describe behavior the code does not have yet, so `tg trace --strict` and their tests will show gaps] → each has a follow-up task naming the symbol to fix.
- [New ADDED requirements have no `@tg: verifies::` annotations yet] → task 2.2 annotates the existing tests they were written from.
- [Archiving before `add-tg-openspec-trace` would drop its "Test call" scenario only to re-add it, but would also leave that change's later archive overwriting these corrections] → archive order is a task.
