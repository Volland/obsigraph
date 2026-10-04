# CLI

The `tg` command line (package `@typedgraph/cli`) is a drop-in replacement for lat.md that also links code into the typed graph. Parts land as OpenSpec changes named `add-tg-*`; sections below say what exists.

## Compatibility contract

`tg` reads the same `lat.md/` folder as lat.md: same section ids, `[[wiki]]` and source links, `@lat:` comments, leading-paragraph rule and `require-code-mention` frontmatter.

"Drop-in" is defined by verdicts: `tg check` and `lat check` must report the same findings on this repository and on real lat.md projects. A differential suite enforces it in CI and gates the release. Typed edges and Cypher are additions on top, never changes to the lat.md format. Specified in `add-tg-check-commands` and `add-tg-lat-resolver`.

## Own implementation

`tg` re-implements lat.md instead of wrapping its npm package, so the parsed sections and code links can feed the existing graph, Cypher engine and styling.

The section tree and link resolver live in `core` with no heavy dependencies, because the plugin bundles `core` and the CLI must start fast in agent hooks. Symbols come from a regex finder behind a `SymbolProvider` interface; tree-sitter is an optional later package, not a base dependency. See [[architecture#Monorepo layout]].

## Resolver

[[packages/core/src/latmd/index.ts#LatIndex]] holds every parsed section and resolves ids and links exactly as lat.md does: case-insensitive, short file stems, implicit h1, tiered fuzzy locate.

Markdown is read by [[packages/core/src/latmd/markdown.ts#parseMarkdown]], a line scanner (no remark) that yields the section tree, wiki links outside code and the `require-code-mention` option; [[packages/core/src/latmd/markdown.ts#leadingParagraphIssue]] applies the 250-character rule. Intentional differences from lat.md: `.mts`, `.cts`, `.mjs` and `.cjs` are accepted as source targets. Edge targets already drop `#subpath`, so nested-heading links never make stub nodes; code targets in edges arrive with the code layer.

## Commands

`tg locate`, `section`, `refs`, `expand` and `check` (`packages/cli/src/commands/`) read the lattice through `Project` (`packages/cli/src/project.mts`) and validate with [[packages/core/src/latmd/check.ts#checkLattice]].

`check` runs lat.md's four checks in its order: links (including source links verified on disk), code references with `require-code-mention` coverage, directory index files and the leading-paragraph rule; `@tg:` annotations are validated too, and a `@tg:` target counts toward coverage. Output mirrors lat (`- file:line: message`), `--json` gives findings, warnings and file counts, and `check md|code-refs|index|sections` runs one. Locate, section, refs and expand print lat-style previews.

### Parity gate

A vitest suite runs the pinned reference `lat check` (0.12.2, installed by the CI and release workflows) and `tg check` on this repository, a seeded fixture and a snapshot of the upstream lat.md project, and compares the normalized finding sets.

The suite skips when `lat` is absent locally. The one intentional difference is that `.mjs`, `.cjs`, `.mts` and `.cts` links are source links for tg and unresolved for lat, so their message text is normalized. The upstream snapshot lives in `packages/cli/test/fixtures/upstream-lat-md` (MIT, with its license) and has over two hundred findings, so it exercises every message kind.

## Symbols

`lookupSymbol` in `packages/core/src/code/symbols.ts` answers found, absent or unresolvable for `file#Class#method` paths using regex finders for TS/JS, Python, Go, Rust and C.

The finders mask comments and strings first (`maskCode`), then track brace depth, so nesting survives braces in strings and regex literals. Absence is only reported when the file scanned cleanly: unbalanced input or a body written on its declaration line makes the answer `unresolvable`, never a false error. Like lat.md, only top-level symbols and one level of members are addressable. `registerProvider` swaps in another implementation per language, the hook for a later tree-sitter package. `packages/cli/src/walk.mts` enumerates files with nested `.gitignore` support through the pure matcher `compileIgnore`.

## Packaging

One bundled package `@typedgraph/cli` exposes the `tg` binary, built with esbuild like the plugin and sidecar. Workspace packages keep their `@obsigraph/*` names and `core` stays private.

`packages/cli` builds `dist/tg.mjs` with esbuild (`npm run build:cli`); `src/cli.mts` holds the registry, argument parsing and exit-code contract (0 ok, 1 findings, 2 usage or internal error), `src/root.mts` the upward root search for `lat.md/` or `.tg/`. Commands register themselves from `src/commands/`. The tag workflow publishes it when an `NPM_TOKEN` secret exists, and `scripts/version-bump.mjs` keeps its version in step.

The public product name is Typed Graph (see [[publishing#Plugin releases]]), so the npm scope is `@typedgraph`. Ownership of that scope was not verifiable during design and must be confirmed before the first publish. A layered library (`@typedgraph/core`) is deferred until the parser API settles.

## Annotations

Code points at docs with `@lat: [[section]]`, a plain `references` link, or `@tg:` followed by the existing inline edge grammar, e.g. `// @tg: implements:: [[auth#Login]] {since: 2}`.

One grammar serves notes, docs and code (see [[edge-syntax#Inline edge form]]). A bare `@tg: [[x]]` equals `@lat:`. The edge source is the symbol declared within three lines after the comment, else the file with a warning. Arrow syntax is deferred.

[[packages/core/src/code/annotations.ts#scanAnnotations]] finds them: `@lat:` uses lat.md's exact pattern (`//` or `#` comments, one link) so both tools see the same references, while `@tg:` also accepts block, JSDoc and SQL-style comments. Targets are checked with [[packages/core/src/code/annotations.ts#checkAnnotationTarget]]; a schema note's `edges` list gives advisory checks through [[packages/core/src/code/annotations.ts#schemaIssues]].

## Code layer

Source files and symbols can appear in the graph as derived `CodeFile` and `CodeSymbol` nodes, off or limited to annotated symbols by default, and never written into the vault.

A `code` setting takes `off`, `annotated` or `all`; the Graph view has a Code toggle and the usual element cap falls back to a table. This keeps [[architecture#Source of truth]] intact: code nodes are derived like the Ladybug mirror. Materialized stub notes exist only through an explicit export. See [[visualization#Surfaces]].

## Search

`tg search` ranks sections lexically with no key or network, and becomes hybrid lexical plus vector when an embedding provider is configured.

[[packages/core/src/latmd/search.ts#LexicalIndex]] scores title, leading paragraph and body with weighted BM25 and is rebuilt on every call. With `TG_EMBED_PROVIDER` (`ollama` or `openai`) or a key set, `packages/cli/src/embed.mts` embeds each section through the sidecar's provider classes and fuses the two rankings with reciprocal rank fusion ([[packages/core/src/latmd/search.ts#fuseRanks]]); nothing is configured by default, so a bare run never touches the network. A failing provider degrades to lexical results with a notice and exit 0. `LAT_LLM_KEY`, `LAT_LLM_KEY_FILE` and `LAT_LLM_KEY_HELPER` are honored as aliases of `TG_EMBED_KEY*`, with lat.md's prefix convention (`sk-` OpenAI, `vck_` Vercel AI Gateway), and keys are never written anywhere. Vectors live in `.tg/vectors.json` plus `.tg/vectors.f32`, keyed by content hash and model, self-ignored by a `.gitignore` inside `.tg/` and rebuilt by `tg reindex`.

## Agent integration

`tg init`, `gen`, `hook` and `mcp` match lat.md's agent layer and add `cypher` and `edges` over the section graph, plus two bundled skills.

Every file write is a dry run printing a diff unless `--write` is passed (`packages/cli/src/commands/init.mts`). The managed block is bounded by `%% tg:begin %%` markers so re-runs replace only it; an existing `lat:begin` block is replaced only with `--migrate`, which also swaps `lat hook claude` hooks and the `lat` MCP entry. `--agent` picks Claude Code (CLAUDE.md, `.claude/settings.json` hooks, `.mcp.json`, skills), `agents` (AGENTS.md) or `cursor`. Templates and skills are markdown files in `packages/cli/templates/`, bundled as text. `tg hook claude UserPromptSubmit|Stop` and `cursor stop` follow lat's JSON protocol, accept the prompt as `prompt` or `user_prompt`, search lexically only (no network in a hook), flag a stale lat.md after 5 or more changed code lines, and always exit 0.

[[packages/core/src/latmd/graph.ts#buildLatGraph]] turns the lattice into a graph for [[query-engine]]: `Section` nodes with `section`, `title`, `file`, `depth`, `startLine`, `endLine` and `summary`, `contains` edges parent to child and `references` edges for resolved wiki links. Section keys replace `#` with `›` because the edge syntax cannot carry `#`. `tg cypher` runs the built-in engine over it; `tg edges` lists annotation edges. `tg mcp` (`createTgMcpServer` in `packages/cli/src/commands/mcp-server.mts`) exposes `tg_locate`, `tg_section`, `tg_search`, `tg_expand`, `tg_check`, `tg_refs`, `tg_cypher` and `tg_edges`, each wrapping the CLI command, and loads the MCP SDK only on demand so other commands stay fast. Cypher results use the sidecar's `_type`-tagged contract from [[sidecar#Interfaces]].

## Vault integration

A `lat.md/` folder inside a vault is read in place through the lat resolver, so nested-heading and code links work in Obsidian without rewriting files; `tg export` and `tg import` cover interchange.

Export projects a vault subset into a lat-conformant folder, flattening typed edges and dropping properties, then verifies it with `check` and prints a loss report. Round trip is not guaranteed on purpose, because lat.md has no equivalent for typed edges.
