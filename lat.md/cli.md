---
openspec: [code-layer, lat-resolver, lat-vault-integration, symbol-provider, tg-agent-integration, tg-annotations, tg-check, tg-cli, tg-search, tg-trace, tg-validate]
---
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

One grammar serves notes, docs and code (see [[edge-syntax#Inline edge form]]). A bare `@tg: [[x]]` equals `@lat:`. The edge source is the symbol declared within three lines after the comment, else the file; only a `@tg:` annotation that falls back to the file gets a warning, an `@lat:` one attaches silently as lat.md does. Arrow syntax is deferred.

[[packages/core/src/code/annotations.ts#scanAnnotations]] finds them: `@lat:` uses lat.md's exact pattern (`//` or `#` comments, one link) so both tools see the same references, while `@tg:` also accepts block, JSDoc and SQL-style comments. [[packages/core/src/code/annotations.ts#checkAnnotationTarget]] (resolve one edge target) and [[packages/core/src/code/annotations.ts#schemaIssues]] (advisory checks against a schema note's `edges` list) are tested core helpers for other callers; `tg check` does not call them and resolves annotation targets through its own link check.

## Code layer

Source files and symbols appear in the graph as derived `CodeFile` and `CodeSymbol` nodes, off by default in the plugin, `annotated` in the CLI, and never written into the vault.

[[packages/core/src/code/layer.ts#buildCodeLayer]] turns scanned files into nodes: `CodeFile` (`lang`, `lines`) and `CodeSymbol` (`name`, `kind`, `lang`, `path`, `symbol`, `lines`), keyed `path` and `path#Class#method`, the same text a `[[path#symbol]]` link carries so links and nodes agree and no stub appears. `contains` edges run from a file to its top-level symbols and from a class to its members; annotation edges keep their type, sign and properties. Mode `annotated` keeps annotated symbols, what annotations point at and their files; `all` keeps every symbol. [[packages/core/src/latmd/graph.ts#buildLatGraph]] adds the layer to the section graph for `tg cypher --code off|annotated|all` (or `TG_CODE`), and prose links to `[[src/x.ts#fn]]` become `references` edges to the symbol node. [[packages/core/src/graph/graph.ts#Graph]] takes an optional subpath resolver so a typed edge in a note, `[[src/auth.ts#login]]`, also ends at the symbol node.

In Obsidian, [[packages/plugin/src/code-layer.ts#CodeLayer]] reads vault source files read-only (folder from the `Code folder` setting) and keeps the nodes current on file changes. The `Code in the graph` setting and a dropdown in the Graph view switch the mode; a block header `code: hide` removes code nodes from one query's graph ([[packages/graph-ui/src/elements.ts#excludeCode]]), and results above the element cap still fall back to a table. Code nodes have distinct built-in styles below every configured style ([[visualization#Styling]]). The sidecar mirror does not yet carry code nodes because the sidecar reads only markdown. See [[architecture#Source of truth]].

## Search

`tg search` ranks sections lexically with no key or network, and becomes hybrid lexical plus vector when an embedding provider is configured.

[[packages/core/src/latmd/search.ts#LexicalIndex]] scores title, leading paragraph and body with weighted BM25 and is rebuilt on every call. With `TG_EMBED_PROVIDER` (`ollama` or `openai`) or a key set, `packages/cli/src/embed.mts` embeds each section through the sidecar's provider classes and fuses the two rankings with reciprocal rank fusion ([[packages/core/src/latmd/search.ts#fuseRanks]]); nothing is configured by default, so a bare run never touches the network. A failing provider degrades to lexical results with a notice and exit 0. `LAT_LLM_KEY`, `LAT_LLM_KEY_FILE` and `LAT_LLM_KEY_HELPER` are honored as aliases of `TG_EMBED_KEY*`, with lat.md's prefix convention (`sk-` OpenAI, `vck_` Vercel AI Gateway), and keys are never written anywhere. Vectors live in `.tg/vectors.json` plus `.tg/vectors.f32`, keyed by content hash and model, self-ignored by a `.gitignore` inside `.tg/` and rebuilt by `tg reindex`.

## Agent integration

`tg init`, `gen`, `hook` and `mcp` match lat.md's agent layer and add `cypher` and `edges` over the section graph, five bundled skills and tg steps in OpenSpec's own skills.

Every file write is a dry run printing a diff unless `--write` is passed (`packages/cli/src/commands/init.mts`). The managed block is bounded by `%% tg:begin %%` markers so re-runs replace only it; an existing `lat:begin` block is replaced only with `--migrate`, which also swaps `lat hook claude` hooks and the `lat` MCP entry. `--agent` picks Claude Code (CLAUDE.md, `.claude/settings.json` hooks, `.mcp.json`, skills), `agents` (AGENTS.md) or `cursor`. Templates and skills are markdown files in `packages/cli/templates/`, bundled as text. For Claude Code, `init` installs the skills `tg-docs` (lat.md maintenance), `tg-graph` (Cypher over the section graph), `tg-trace` (linking OpenSpec requirements to code, tests and docs), `tg-impact` (what a code change touches, before and after) and `tg-audit` (specs against code, classified as stale spec, code bug or open decision). When OpenSpec's propose, apply, archive or explore skills (`.claude/skills/openspec-*/SKILL.md`) or `/opsx` commands exist, `withOpenspecBlock` in `packages/cli/src/commands/init.mts` appends the matching block from `packages/cli/templates/openspec/` between `<!-- tg:begin -->` and `<!-- tg:end -->` and replaces only that block later, so `openspec update` followed by `tg init --write` restores it; `--no-openspec` skips this and `--skills-only` writes nothing but skills and patches. `tg gen` prints every skill and block. `tg hook claude UserPromptSubmit|Stop` and `cursor stop` follow lat's JSON protocol, accept the prompt as `prompt` or `user_prompt`, search lexically only (no network in a hook), flag a stale lat.md after 5 or more changed code lines, and always exit 0.

## Code ontology

`tg init` also installs a small shared vocabulary for intent and code, the note `lat.md/code-ontology.md` and its Typed Graph Schema `ontology/code-types.md`, so people and agents use the same names.

The templates live in `packages/cli/templates/ontology/` and print with `tg gen ontology.md` and `tg gen ontology-schema.md`. Six intent types (Decision, Requirement, Scenario, Constraint, Concept, Change) and eleven edge types (`implements`, `verifies`, `-contradicts`, `supersedes`, `motivated_by`, `constrains`, `refines`, `depends_on`, `defines`, `introduced_by`, `changed_by`) are declared as [[shacl#Typed Graph Schema]], so the schema exports to SHACL (`tg schema export shapes.ttl --schema-folder ontology`) and opens in the Obsidian plugin. The schema sits outside `lat.md/` because every note directly in a schema folder declares a type. Both files are written only when absent, so a project owns them after the first run, and the note is appended to the lat.md index so `tg check` stays green; `--no-ontology` skips them. A `type:` in a lat.md file's frontmatter labels the sections below its title in `tg cypher`. Typed edges are written from code with `@tg:`; section-to-section links stay plain `references` in the CLI graph.

## Section graph

The lattice becomes a property graph that `tg cypher`, `tg edges` and the MCP server query.

[[packages/core/src/latmd/graph.ts#buildLatGraph]] turns the lattice into a graph for [[query-engine]]: `Section` nodes with `section`, `title`, `file`, `depth`, `startLine`, `endLine` and `summary`, `contains` edges parent to child and `references` edges for resolved wiki links. `tg cypher` runs the built-in engine over it; `tg edges` lists annotation edges. `tg mcp` (`createTgMcpServer` in `packages/cli/src/commands/mcp-server.mts`) exposes `tg_locate`, `tg_section`, `tg_search`, `tg_expand`, `tg_check`, `tg_refs`, `tg_cypher`, `tg_edges` and `tg_trace`, each wrapping the CLI command, and loads the MCP SDK only on demand so other commands stay fast. Cypher results use the sidecar's `_type`-tagged contract from [[sidecar#Interfaces]].

## Requirement trace

`tg` reads OpenSpec requirements and links them to code, tests and docs: `@tg: implements::` on code, `@tg: verifies::` on tests, `openspec:` frontmatter in lat.md files, and `tg trace` reports the gaps.

[[packages/core/src/openspec/index.ts#SpecIndex]] parses `openspec/specs/<capability>/spec.md` and the ADDED and MODIFIED requirements of unarchived changes (status `pending`, REMOVED names recorded in `removedBy`). Targets are `openspec:<capability>#<requirement>[#<scenario>]`, matched case-insensitively with whitespace collapsed; a main-spec requirement wins over a pending one, and misses get a nearest-id suggestion. The `openspec:` scheme keeps these ids out of lat.md id space, so short-id resolution and `lat check` parity are untouched: lat ignores `@tg:` and unknown frontmatter keys.

A `@tg:` comment directly above a test call (`it`, `test`, `describe`, with `.each`, `.skip`, `.only` and similar) attaches to the file without a warning and puts `test: <name>` on each edge, so a test carries `@lat:` for its test-spec section and `@tg: verifies::` for the scenario it proves. A lat.md file lists what it explains as `openspec: [capability, "capability#Requirement"]` in frontmatter.

`tg check` passes the index to [[packages/core/src/latmd/check.ts#checkLattice]], which reports unresolved `openspec:` annotation targets and unknown frontmatter entries; hosts that pass no index (plugin, export) skip these checks. Missing traceability is never a check finding. [[packages/core/src/openspec/trace.ts#traceRequirements]] builds the matrix for `tg trace [capability...] [--gaps] [--strict] [--json]` (`packages/cli/src/commands/trace.mts`): a requirement is implemented when an `implements` edge reaches it or a scenario, verified when every scenario has a `verifies` edge, and documented when frontmatter names it. `--strict` exits 1 on any unimplemented or unverified requirement. [[packages/core/src/latmd/graph.ts#buildLatGraph]] adds `Requirement` and `Scenario` nodes linked by `contains`, so `tg cypher`, `tg edges` and the `tg_trace` MCP tool see the same links.

## Vault integration

A `lat.md/` folder inside a vault is read in place through the lat resolver, so nested-heading and short-id links work in Obsidian without rewriting files; `tg export` and `tg import` cover interchange.

In the plugin, [[packages/plugin/src/vault-index.ts#VaultIndex]] feeds every note under a `lat.md/` folder (vault root or nested) into a [[packages/core/src/latmd/index.ts#LatIndex]]. A capture-phase click handler in `main.ts` sends `a.internal-link` clicks through [[packages/plugin/src/lat-links.ts#latLinkTarget]]: a section id opens its file at the section line (Obsidian itself cannot resolve `#Heading#Sub`), a source target shows a notice, an ambiguous one lists candidates, and plain note links are left to Obsidian. [[packages/plugin/src/lat-links.ts#latDiagnostics]] adds broken links and leading-paragraph violations to the diagnostics list; directory-index and source checks stay in the CLI. File-level backlinks already work because Obsidian resolves the file part of the link, and hover previews are not customized.

`tg export <out> [--vault dir] [--folder sub] [--force]` (`packages/cli/src/commands/export.mts`) projects notes with [[packages/core/src/latmd/export.ts#exportLattice]]: typed edge lines become `type: [[link]]` (negative ones say "(negative)"), property blocks are dropped, `{{edge: ...}}` embeds become their value, notes without a level-1 heading get one from the file name, ambiguous links get a full path, links to notes outside the export become plain text, and missing directory index files are generated or completed. The result is written under `<out>/lat.md/`, verified with the normal `check`, and a loss report counts every flattened or dropped construct. It is lossy on purpose, because lat.md has no equivalent for typed edges, and refuses a non-empty target without `--force` or one inside the exported notes. Findings the export cannot fix, such as a leading paragraph over 250 characters, are listed and make the exit code 1.

`tg export <out> --format okf` writes an Open Knowledge Format bundle instead, keeping typed edges as prose, and `tg okf check [dir]` validates any folder against OKF conformance; both are described in [[okf]].

`tg import <path> [--mount] [--into name]` copies a `lat.md/` folder (or the one inside a project directory) into the current vault or project, or symlinks it with `--mount`. It refuses a non-empty destination and never modifies the source.

## Vault validation

`tg validate` checks a whole vault against its schema notes outside Obsidian, with the findings the plugin's diagnostics list shows, stable codes and text, JSON or SARIF output for CI.

[[packages/core/src/validate/validate.ts#validateVault]] builds the graph from parsed notes and collects edge syntax, TGS declaration, schema validation, style and embed diagnostics through [[packages/core/src/validate/validate.ts#vaultDiagnostics]], the same function [[packages/plugin/src/vault-index.ts#VaultIndex]] calls, so the two cannot disagree; lat.md link findings stay plugin-only and in `tg check`. Every `Diagnostic` carries a `code` set where it is created: the TGS diagnostic names, `edge-syntax`, `style`, `embed`, plus `annotation` and `lat-link` outside this command. [[packages/core/src/validate/validate.ts#severityOf]] makes `invalid-declaration`, `unsupported-version` and `duplicate-declaration` errors and everything else warnings, since validation is advisory; [[packages/core/src/validate/validate.ts#toFindings]] converts lines to 1-based (null for note-level findings) and sorts by path, line and code.

`tg validate [--vault dir] [--schema-folder Types] [--only codes] [--ignore codes] [--schema-only] [--strict] [--format text|json|sarif]` (`packages/cli/src/commands/validate.mts`) reads notes with `@obsigraph/node-vault`, skipping dot folders, and never writes. Exit 0 without errors, 1 with an error (or any warning under `--strict`), 2 for a missing vault or unknown format. `--schema-only` checks only the schema notes' declarations, cheap enough for a pre-commit hook. `--json` prints `ok`, `notes`, `counts` and `findings`; `--format sarif` writes SARIF 2.1.0 by hand with one rule per code in use and locations relative to the working directory, for GitHub code scanning.
