## 1. Before archive

- [x] 1.1 Archive `add-tg-openspec-trace` first; it modifies tg-annotations "Edge source", which this delta rewrites on top of it
- [x] 1.2 Resolve the open questions in `proposal.md`; for each answer, edit the affected delta (tg-annotations "Annotation validation", sidecar-mcp-graphrag and vector-index mismatch, vscode-extension "Graph webview", vector-index "Combined vector and graph query", tg-cli exit codes, tg-agent-integration Cursor hooks)
- [x] 1.3 Re-check that no requirement or scenario name changed: every `openspec:` annotation in the repo still resolves (`tg check`)

## 2. Archive

- [x] 2.1 Run `openspec validate align-specs-with-code --strict` and archive the change
- [x] 2.2 Add `@tg: verifies::` annotations from the existing tests to the new capabilities (`typed-note-creation` in `packages/core/test/new-notes.test.ts` and `packages/vscode/test`, `ontology-gallery` in `packages/core/test/ontologies.test.ts` and `ontology-trail.test.ts`, `plugin-install` in `packages/plugin/test/install.test.ts`, `example-vault` in `packages/plugin/test/example-vault.test.ts` and `packages/sidecar/test/example-ladybug.test.ts`) and to the tests behind the ADDED requirements
- [x] 2.3 Run `tg check`, `lat check` and `openspec validate --all --strict`

## 3. Docs follow-up (lat.md)

- [x] 3.1 `lat.md/shacl.md` and `lat.md/publishing.md`: TGS 0.2 is current, rendered to `spec/tgs/v0.2/` with 0.1 archived
- [x] 3.2 `lat.md/vector-search.md`: vectors live in the data directory, not Ladybug; search answers 503 while the provider is down; combination is the `then` follow-up query
- [x] 3.3 `lat.md/cli.md`: `checkAnnotationTarget` and `schemaIssues` are not called by `tg check` (until open question 1 is settled); the file fallback warning is `@tg:` only
- [x] 3.4 `lat.md/query-engine.md`: list the header options `height`, `backend` and `code`; note which constructs currently fail as syntax errors
- [x] 3.5 `lat.md/sidecar.md`: error statuses include 401, 404, 405, 413 and 503

## 4. Code fixes

Each item keeps the spec as written; each fix landed with a test.

- [x] 4.1 `packages/core/src/shacl/write.ts#planImport`: warn for every `tgs:templateBody` not written to its type's note, also when the note already exists (today the body is lost silently)
- [x] 4.2 `packages/core/src/cypher/parser.ts#parseQuery`: recognize list comprehensions, map projections, pattern predicates and `COUNT {}` subqueries and raise `unsupported` naming them; this also lets `packages/sidecar/src/ladybug/backend.mts#LadybugBackend#run` pass them to Ladybug
- [x] 4.3 `packages/core/src/cypher/exec.ts#queryColumns`: report a variable-length relationship variable as a list (scalar) column, not `relationship`
- [x] 4.4 `packages/sidecar/conformance/compare.mts#classify`: accept an expected difference only when the divergence matches its documented nature; print the `summarize` counts from `packages/sidecar/conformance/runner.mts#runCorpus`
- [x] 4.5 `packages/sidecar/conformance/corpus.json`: add `CREATE`, `MERGE`, `SET`, `DELETE` and `REMOVE` queries with expected kind `readonly` on both engines
- [x] 4.6 `packages/sidecar/test/conformance.test.ts`: derive clauses and operators from tables exported by `packages/core/src/cypher/parser.ts` and match parsed constructs instead of substrings
- [x] 4.7 `packages/sidecar/src/ladybug/backend.mts#LadybugBackend#run`: when the last mirror sync failed, return the failure (or a staleness notice) instead of serving the old snapshot silently; report a failed first sync as a terminal error, not `not_ready` forever
- [x] 4.8 `packages/sidecar/src/main.mts#startSidecar`: catch failures of `LadybugStore.open` and `LadybugMirror.open`, discard and rebuild a corrupt mirror, and keep the sidecar serving with mirror status `failed` or `unavailable`
- [x] 4.9 `packages/sidecar/src/rag/retrieve.mts#retrieve`: add a total returned-text budget and set `truncated` when it drops chunks
- [x] 4.10 `packages/sidecar/src/ops.mts#Ops#retrieve`: flag answers from a mismatched index with `stale: true` and a notice, as `Ops#search` does
- [x] 4.11 `packages/sidecar/src/ops.mts#Ops#search` and `#Ops#retrieve`: refuse queries when the stored and active dimensions differ; make `packages/core/src/embed/chunk.ts#cosine` throw on vectors of different length instead of returning NaN
- [x] 4.12 `packages/sidecar/src/vectors/provider.mts#checkVectors`: reject empty vectors and vectors of differing length as a bad response naming the endpoint
- [x] 4.13 `packages/sidecar/src/vectors/provider.mts#post`: add a request timeout (AbortSignal) so an unresponsive endpoint fails, letting `tg search` fall back to lexical results
- [x] 4.14 `packages/cli/src/embed.mts#readKey`: check `TG_EMBED_KEY`, `TG_EMBED_KEY_FILE` and `TG_EMBED_KEY_HELPER` before any `LAT_LLM_KEY*` variable; add a test with `TG_EMBED_KEY_FILE` and `LAT_LLM_KEY` both set
- [x] 4.15 `packages/cli/src/commands/read.mts` (`section`, `refs`, `expand`): print a JSON document under `--json` when nothing matches or a ref fails, keeping exit codes 1 and 2
- [x] 4.16 `packages/sidecar/src/mcp/server.mts#createMcpServer`: report the sidecar package version instead of the hard-coded `0.4.1`
- [x] 4.17 `packages/vscode/src/extension.ts#activate` (backlinks tree `getChildren`): show a distinct message for a file outside `typegraph.roots`
- [x] 4.18 `packages/vscode/src/extension.ts#activate` (backlinks tree `getChildren`): return no children when setup is needed so the "Set up TypeGraph" welcome content in `packages/vscode/package.json` becomes visible, or show the offer as a tree item
- [x] 4.19 `packages/plugin/test`: add a test that indexing an in-vault lat.md folder leaves its files byte-identical (lat-vault-integration "Read in place")
