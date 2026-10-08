## Why

An audit of all 32 OpenSpec capabilities against the code found 172 requirements implemented, 27 partial and 13 drifted. Some specs describe behavior that was later changed on purpose (and is tested, documented in lat.md and released), some describe the right behavior that the code gets wrong, and some still name TGS 0.1, bare MCP tool names or a "plugin version". Four shipped features (typed note creation with ids and templates, the ontology gallery, the plugin install check and the example vault) have no spec at all. Now that code carries `@tg: implements::` and `@tg: verifies::` annotations pointing at requirements, stale requirement text misleads every trace.

## What Changes

- Correct the requirement text where the code is the intended behavior: MODIFIED deltas with the complete requirement, the same requirement and scenario names (so existing `openspec:` annotations keep resolving) and added scenarios where the old ones were vague.
- Keep the spec where the code is wrong and list each such bug under "Code fixes (follow-up)" in `tasks.md`; no code changes in this change.
- Replace untestable wording ("shortly", "short debounce interval", "in this version", "rebuild prompt", "behavior preserved") with concrete triggers and outcomes.
- Update stale names and versions: TGS 0.2 with 0.1 archived, the `tgs:templateBody` term, `tg_*` MCP tool names, `tg init --write`, the sidecar MCP server version, the mirror manifest contents.
- **BREAKING (spec only)**: remove graph-ui "Plugin behavior preserved", a migration-only requirement that no annotation targets.
- Add focused requirements for important unspecified behavior (about one to three per capability), such as Cypher parameters, error kinds and timeouts, stdio MCP mode, retrieve parameter bounds, directory index files, `tg cypher` and `tg edges`.
- Add four capabilities for shipped features with scenarios grounded in existing tests.

## Capabilities

### New Capabilities
- `typed-note-creation`: id rules of TGS 0.2 (`uuid`, `uuid7`, `timestamp`, `luhmann`), id generation, template tokens, file names with ids, Luhmann placement and the note creation commands in Obsidian and VS Code.
- `ontology-gallery`: the downloadable ontologies, their composition through `core`, mixins, the Zettelkasten walkthrough, OKF export and the gallery downloads.
- `plugin-install`: installable manifest, release assets, bundle load in Obsidian and the scheduled install check.
- `example-vault`: the demo vault as a tested user manual and its release asset.

### Modified Capabilities
- `chunking-verbalization`, `code-layer`, `cypher-extensions`, `cypher-query`, `edge-embeds`, `edge-parsing`, `embedding-provider`, `engine-conformance`, `graph-model`, `graph-query-block`, `graph-ui`, `graph-view`, `ladybug-backend`, `ladybug-mirror`, `lat-resolver`, `lat-vault-integration`, `node-vault-loader`, `okf-compat`, `schema-notes`, `shacl-interop`, `sidecar-mcp-graphrag`, `sidecar-service`, `symbol-provider`, `tg-agent-integration`, `tg-annotations`, `tg-check`, `tg-cli`, `tg-search`, `tgs-spec`, `vector-index`, `visualization-config`, `vscode-extension`: corrected, clarified or extended requirements as classified in `design.md`.

## Impact

- `openspec/specs/` only, on archive. No source, test or lat.md file changes in this change.
- Requirement and scenario names are unchanged, so existing `@tg:` annotations stay valid; new requirements can be annotated after archive.
- 19 code fixes become follow-up work (`tasks.md`), several of them correctness bugs: silent template loss on SHACL import, NaN similarity on embedding dimension mismatch, `tg search` hanging on an unresponsive provider, wrong key precedence, a corrupt Ladybug database stopping the sidecar.
- Must be archived after `add-tg-openspec-trace`, which modifies the same tg-annotations "Edge source" requirement; this delta already includes that change's "Test call" scenario.

## Decisions on the audit's open questions

1. **Annotation schema checks**: dropped from the requirement; `schemaIssues` and `checkAnnotationTarget` stay as tested core helpers that `tg check` does not call.
2. **Model mismatch**: answer from the old index flagged `stale` when dimensions match, refuse with an error when they differ, in both search and retrieve.
3. **VS Code graph expansions**: cleared when the active file changes, as in Obsidian.
4. **Schema styles in VS Code**: built-in type styles only, specified as such.
5. **`then` over MCP**: added to the MCP `vector_search` tool.
6. **"No results" exit code**: stays 1, now stated in tg-cli, with a JSON document under `--json`.
7. **Cursor hooks**: `tg init` writes Cursor rules only; `tg hook cursor stop` remains for manual hook setup.
8. **Multi-root VS Code**: the first workspace folder only, specified as such.
