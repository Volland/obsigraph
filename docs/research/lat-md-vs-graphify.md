# lat.md vs graphify, and what Typed Graph should take

Research note, Oct 9, 2026. It compares two ways of giving coding agents a knowledge graph of a codebase and asks whether `tg` should derive a graph automatically from code, not only from what people and agents write.

- **lat.md** ([github.com/1st1/lat.md](https://github.com/1st1/lat.md), npm `lat.md`, v0.13.0, TypeScript): the graph is written in Markdown by people and agents.
- **graphify** (PyPI `graphifyy`, v0.9.82, Python, a Claude Code skill backed by a library): the graph is extracted from the corpus by a pipeline.
- **tg** (`@typedgraph/cli` 0.11.0): this project. Today it is a lat.md drop-in with typed edges, Cypher and OpenSpec traceability.

The facts below come from the source of both projects (local checkouts at `lat.md-code/` and `graphify/`) and from this repository's `lat.md/` docs.

## TL;DR

The two tools answer different questions, so they are complementary, not rivals.

- **lat.md** is a curated **intent graph**: *why* the system is the way it is, plus decisions, constraints and test intent. People and agents write it. The tool only validates it and helps navigate it.
- **graphify** is a derived **structure graph**: *what* is in the corpus and *how* it connects. A pipeline extracts it, regenerates it on every commit, and nobody edits it by hand.
- **The "magic" is narrower than it looks.** graphify's code pass is deterministic tree-sitter parsing with no LLM. The LLM only reads docs, PDFs, images and transcripts. So "build from the codebase" does not have to mean "generate with an LLM".
- **tg's own ground is the typed bridge between the two:** `implements`, `verifies` and `motivated_by` edges from intent to code. Neither tool has these.

**Recommendation:** keep the curated intent graph as the product. Add a thin, deterministic derived layer with provenance on every edge, plus inferred link proposals that a person reviews in the PR. Do not build a graphify clone: no LLM inside the tool, no multimodal ingestion, no 40-language extractor. That is a second product and conflicts with the roadmap's focus (gap 1, "breadth ahead of adoption").

## How lat.md works

lat.md stores a project's knowledge as Markdown sections that link to each other and to code. A strict checker keeps them consistent.

**Model.** A `lat.md/` folder of Markdown files. Each heading is a section with an id such as `auth#OAuth Flow`. Sections link with `[[wiki links]]` and point into code with `[[src/auth.ts#validateToken]]`. Code points back with `// @lat: [[section]]` comments (`lat.md-code/README.md`).

**Who writes it.** People and agents write every word; the tool generates no prose. `lat init` sets up the selected agent with hooks, instructions and a skill. For an existing repository, `lat.md-code/lat.md/quick-start.md` gives the *agent* a seeding prompt:

> Capture the project's purpose, architecture, domain rules, non-obvious constraints, key decisions … explain what the system does and why, not a file-by-file tour … Distinguish verified behavior from inferred intent, and flag important unknowns for my review instead of inventing rationale.

The LLM lives in the coding agent, and the tool is LLM-free. `lat gen` only prints templates such as `AGENTS.md`, cursor rules and the skill (`lat.md-code/src/cli/gen.ts`).

**Validation.** `lat check` enforces:

- links resolve, including source links to real symbols;
- code references, and coverage of sections marked `require-code-mention`;
- directory index files exist;
- every section starts with a leading paragraph of at most 250 characters.

Agents run it before they finish a task, and it also ships as a GitHub Action.

**Code parsing.** Code is parsed only to check that a linked symbol exists, never to create content. It uses `web-tree-sitter` with prebuilt WASM grammars from `@repomix/tree-sitter-wasms` (`lat.md-code/packages/core/src/source-parser.ts`).

**Navigation.** `locate`, `section`, `refs`, `expand`, `search`, `mcp` and `ui`. Search runs offline by default on a bundled MiniLM model compiled to WebAssembly; an OpenAI or Vercel key switches it to hosted embeddings.

**Failure modes.**

- Docs get written only if someone writes them, so seeding a large existing repository is slow.
- The graph covers only what was written, so coverage of the code is partial by design.
- Drift is caught only where explicit links exist. Prose next to code that changed but that no link ties to that code goes stale silently.

## How graphify works

graphify runs a pipeline over a folder of code, docs and media and writes a graph plus reports to `graphify-out/`. It is regenerated, not edited.

**Pipeline.** `detect → extract → build → cluster → analyze → report → export` (`graphify/ARCHITECTURE.md`). The stages pass plain dicts and NetworkX graphs to each other. Extraction has three passes (`graphify/docs/how-it-works.md`):

| Pass | Input | Method | Cost |
| --- | --- | --- | --- |
| 1 Code | ~37 tree-sitter grammars, plus SQL, Terraform, manifests and MCP configs | Deterministic AST: classes, functions, imports, inheritance, a second pass that infers call edges, and `# WHY:` / `# NOTE:` comments as rationale nodes | Free, local |
| 2 Media | Audio and video | Local faster-whisper; the transcription prompt is seeded with the code graph's most-connected nodes | Free, local |
| 3 Docs | Markdown, PDF, images, transcripts | Parallel Claude subagents return JSON fragments of nodes, edges and hyperedges | Costs tokens |

Code files never go to the LLM. A code-only corpus skips pass 3 entirely.

**Schema.** Each node has an `id`, a `label`, a `file_type` (`code`, `document`, `paper`, `image` or `rationale`) and a `source_file`. Each edge has:

- a `relation`, a verb such as `calls`, `imports`, `implements` or `semantically_similar_to`;
- a `confidence` and, for inferred edges, a `confidence_score`.

| Confidence | Meaning | Score |
| --- | --- | --- |
| `EXTRACTED` | Stated in the source (an import, a direct call) | 1.0 |
| `INFERRED` | A deduction | Rubric: 0.95 near-certain, 0.85 strong, 0.75 reasonable, 0.65 naming only, 0.55 speculative |
| `AMBIGUOUS` | Uncertain | Flagged for human review in the report |

**Analysis.** Leiden community detection groups nodes by edge density, with no embeddings. The analysis finds:

- "god nodes", the most-connected concepts;
- surprising cross-module connections;
- import cycles;
- suggested questions.

The results are written to `GRAPH_REPORT.md`. Exports include JSON, HTML, an Obsidian vault, SVG, GraphML, Canvas, Cypher, and a Markdown wiki with one article per community, built from the graph's structure rather than LLM prose (`graphify/graphify/wiki.py`). Community labels come from each community's hub node, with no LLM (`graphify/graphify/cluster.py`).

**Freshness.** Every file is fingerprinted by SHA-256, and `--update` re-extracts only files that changed. `graphify hook install` adds git hooks that rebuild after a commit or a branch switch; the AST-only rebuild costs no tokens. It also adds a merge driver for `graph.json`. `graphify-out/` is gitignored by default, and teams force-add `graph.json` and the report to share them (`graphify/README.md`, "Team setup").

**Query side.** `graphify query`, `path` and `explain` work on the CLI and over an MCP server (stdio or HTTP). The MCP tools are `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes` and `shortest_path`. Matching is lexical (substring, IDF and trigrams), with no embeddings (`graphify/graphify/serve.py`). Saved query outcomes feed `graphify reflect`, which writes `LESSONS.md` hints back into later queries. "Always-on" installers cover about 20 agents; on Claude Code, a PreToolUse hook nudges the agent from grep and file reads toward the graph.

**Claimed payoff.** 71.5x fewer tokens per query on a corpus of 52 files, but about 1x on 6 files. The value grows with corpus size. On a small repository the gain is structural clarity, not compression.

**Direction.** The file-level summaries RFC (`graphify/docs/node-summaries-rfc.md`) keeps "offline, deterministic behavior by default" and leaves LLM summaries as a later opt-in. Even graphify treats generated prose with caution.

**Failure modes.**

- No rationale for code beyond tagged comments: the graph knows *that* `A` calls `B`, not *why*.
- Inferred edges add noise. Confidence tags help, but someone has to read them.
- The output is a large regenerated artifact. Its diffs are unreadable in review, which is why it stays out of git by default.
- The doc pass costs tokens and is not reproducible run to run. graphify's own skill text lists failures such as ghost duplicates, truncated JSON and dropped chunks, and the HTML view becomes unusable above about 5,000 nodes.
- The graph goes stale after a `git pull` until someone runs `graphify update .` by hand.

## Side by side

| Dimension | lat.md | graphify |
| --- | --- | --- |
| Captures | Intent: why, decisions, constraints, test specs | Structure: what exists and how it connects |
| Authored by | People and agents, by hand | A pipeline (AST for code, LLM for docs and media) |
| Source of truth | The Markdown in `lat.md/` | The corpus; the graph is a derived cache |
| LLM inside the tool | None; the agent writes | Only the doc and media pass |
| Determinism | Fully deterministic checks | Code pass deterministic; doc pass not |
| Coverage | Partial, wherever someone wrote | Total, every symbol and file |
| Freshness | Agent updates docs in the same PR; `lat check` catches broken links | Rebuilt by hooks on commit and checkout |
| In review | Small, readable intent diffs, the point of the tool | Regenerated JSON, kept out of git by default |
| Trust signal | A person or agent wrote it, and it was reviewed | `EXTRACTED`, `INFERRED` and `AMBIGUOUS` tags |
| Time to value on an existing repository | Slow: someone has to write the docs | Minutes: run it |
| Scales with | Writing discipline | Corpus size, and better at large sizes |
| Typical failure | Docs never written, or rotting next to changed code | Knows *that*, not *why*; noisy inferred edges |

## Where tg sits today

tg already sits between the two. It is a curated intent graph with a small derived code layer.

- **Curated, like lat.md.** tg reads the same `lat.md/` folder and must report the same findings as `lat check` (the parity gate in `lat.md/cli.md`). It adds typed edges written by hand: `@tg: implements:: [[...]]` and `verifies::`, OpenSpec requirement traceability, Cypher, schema validation and SHACL.
- **Derived, a little.** `buildCodeLayer` (`packages/core/src/code/layer.ts`) already creates `CodeFile` and `CodeSymbol` nodes with `contains` edges. It has three modes (`off`, `annotated`, `all`) and is "never written into the vault". Symbols come from regex finders (`packages/core/src/code/symbols.ts`) behind `registerProvider`, which was designed as the hook for an optional tree-sitter package.
- **The bottleneck.** The roadmap's gap 4 says "traceability pays off only after code is annotated by hand". Phase 2 already plans `tg init --infer` to address it.

The principle graphify follows, "derived data is regenerated, never edited", already holds in tg's code layer. The open question is how far to extend that layer.

## Is auto-generation worse? Is it too much?

Two different things get called "auto-generation", and they deserve different answers.

**1. Derived facts: yes, in scope.** Symbols, imports, calls and "this file changed under this section" can be extracted deterministically, regenerated freely and kept out of the notes. They cost no tokens, cannot hallucinate and stay fresh. graphify shows how much value this layer gives an agent: navigation without grep, and impact analysis. tg needs some of it for its own wedge, since `tg impact` and the PR comment are only as good as the reach they can compute.

**2. Generated prose: no, not inside the tool.** LLM-written docs:

- invent rationale (the one thing lat.md's seeding prompt explicitly forbids);
- produce large diffs nobody reviews;
- go stale the moment the code changes, because nothing ties a sentence to a symbol.

lat.md's answer is right: the agent writes prose as part of the task, through a skill, and the tool checks it. tg should keep that split.

**3. A full graphify-style extractor: too much for one project.** Matching graphify means owning about 40 grammars, a media pipeline, a clustering and reporting product and per-agent installers. That is a second product. It would repeat the roadmap's gap 1 (breadth ahead of adoption), break the freeze on new formats, and compete with a mature tool on that tool's own ground. Where breadth is wanted, interoperate instead (recommendation 5).

The useful idea to borrow is not "generate docs". It is **provenance**: label every edge by where it came from, so curated and derived knowledge can live in one graph without being confused.

## Recommendations

Ranked by value to the wedge ("specs and docs that know where their code is") divided by cost. Effort: S is days, M is about one to two weeks, L is more than that.

| # | Feature | Effort | Risk | Why it fits |
| --- | --- | --- | --- | --- |
| 1 | Edge provenance | S | Low | Foundation for mixing derived and curated edges safely |
| 2 | `tg init --infer` as proposals | M | Medium (precision) | Removes the annotation bottleneck; already Phase 2 |
| 3 | Structural edges in the code layer | M | Low to medium | Powers `tg impact --since` and the PR comment |
| 4 | Drift signal for sections | S to M | Low | Catches lat.md's main failure mode; good for the Action |
| 5 | graphify interop | S to M | Low | Breadth without owning extractors |
| 6 | `tg-seed` skill | S | Low | Faster first docs, prose still written by the agent |

### 1. Edge provenance

Add `origin: asserted | extracted | inferred` to every edge, plus `confidence` (0 to 1) on inferred edges, borrowing graphify's rubric.

- **`asserted`:** written by a person or agent: `@tg:`, `@lat:` or a wiki link.
- **`extracted`:** produced by a parser.
- **`inferred`:** a proposal, never authoritative.

Cypher can then filter (`WHERE r.origin = 'asserted'`), and `tg trace` counts only asserted edges as coverage. Without this, adding derived edges makes the graph less trustworthy, not more.

### 2. `tg init --infer` as reviewable proposals

Match OpenSpec requirements and lat.md sections to symbols by name, path, the docstring of the symbol under an existing link, and test names. Emit `@tg: implements::` candidates with a confidence score as a dry-run diff, like every other `tg` write. Nothing is written without `--write`, and low-confidence candidates go into a report rather than the diff. This is graphify's `INFERRED` and `AMBIGUOUS` split applied to tg's own edges. It produces a first useful trace without hand annotation, which is the Phase 2 gate.

### 3. Structural edges in the code layer

Add `imports` edges between `CodeFile` nodes; a regex is enough for TS, JS, Python and Go. Later, add `calls` edges through an optional tree-sitter `SymbolProvider` package; lat.md shows that WASM grammars can ship without native binaries. These edges are `extracted`, derived on every run and never written to notes.

Their purpose is reach. `tg impact --since <ref>` can then say "you changed `parseToken`, which `login` calls, which implements `auth#Login`, which is verified by these scenarios". That sentence is the PR comment the GitHub Action needs.

### 4. Drift signal for sections

When a diff touches a symbol that a section links to, or a symbol carrying an `@lat:` or `@tg:` back-reference, report that section as *possibly stale*. Do not edit it. This replaces the hook's current heuristic (flag after 5 or more changed code lines) with a targeted list. The same list goes in the Action's PR comment. It addresses lat.md's main failure mode, docs rotting next to code that changed, without generating anything.

### 5. Interoperate with graphify instead of rebuilding it

Add `tg import --graphify graphify-out/graph.json`. It maps graphify's code nodes onto `CodeFile` and `CodeSymbol` ids and its edges onto `extracted` edges (`EXTRACTED`) or `inferred` edges (`INFERRED`, keeping `confidence_score`). It is read-only and derived like the rest of the code layer.

Users who want 40 languages, call graphs or docs-to-graph extraction run graphify, and tg adds the typed intent layer on top. This turns a competitor into a feeder and costs one adapter. It is optional: do it only if an outside user asks.

### 6. A `tg-seed` skill, not a seed engine

Ship a skill in the spirit of lat.md's quick-start prompt. It tells the agent to:

- use `tg cypher --code all`, and graphify's communities when they are present, as a map of the codebase;
- draft intent sections for the main subsystems;
- mark inferred rationale as such and list open questions for a person.

The tool stays LLM-free; the agent writes; `tg check` validates.

### Do not take

- **An LLM call inside `tg`.** Keep the CLI deterministic, offline and fast enough for hooks.
- **Multimodal ingestion** (PDF, images, video). It is off the wedge and breaks the format freeze.
- **God nodes, communities and "surprising connections" as a product surface.** They are nice to show, but do not serve traceability. If wanted, read them from graphify through recommendation 5.
- **A regenerated wiki inside `lat.md/`.** Generated prose in the curated folder mixes provenance at the file level and floods reviews.

## Open questions for the maintainer

1. **Tree-sitter in the CLI bundle.** Is a WASM grammar package acceptable as an optional dependency, as lat.md already does, or should calls stay regex-only? This decides the effort of recommendation 3.
2. **graphify's format as an input.** Is it worth depending on `graph.json`? Its edge-direction quirks (`_src` and `_tgt` markers, see `graphify/ARCHITECTURE.md`) mean the adapter needs tests against real output.
3. **Inference threshold.** Above what confidence should `--infer` put a candidate in the diff rather than in the report? graphify's 0.85 "strong evidence" level is a reasonable starting point.
4. **Asserted-only coverage.** Should `tg trace --strict` ever accept `inferred` edges? The recommendation is no.

## Sources

**lat.md**

- `lat.md-code/README.md`: model, CLI, search configuration.
- `lat.md-code/lat.md/quick-start.md`: the agent seeding prompt.
- `lat.md-code/src/cli/gen.ts`: `gen` prints templates only.
- `lat.md-code/packages/core/src/source-parser.ts`: tree-sitter symbol parsing.

**graphify**

- `graphify/ARCHITECTURE.md`: pipeline, schema, confidence labels, edge direction.
- `graphify/docs/how-it-works.md`: the three passes, confidence rubric, cache, token benchmark.
- `graphify/README.md`: capabilities, file types, always-on hooks, team setup and the hook workflow.
- `graphify/docs/node-summaries-rfc.md`: deterministic-first summaries.

**tg**

- `lat.md/cli.md`: compatibility contract, symbols, code layer, annotations, trace, hooks.
- `lat.md/roadmap.md`: assessment gaps, focus, Phase 2 `tg init --infer`.
- `packages/core/src/code/layer.ts`, `packages/core/src/code/symbols.ts`.
