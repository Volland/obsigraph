# Changelog

All notable changes to the Typed Graph plugin, the `tg` CLI, the core library and the sidecar. The VS Code extension keeps its own [changelog](packages/vscode/CHANGELOG.md).

## 0.11.0 — 2026-10-08

### Added

- **Three advanced skills (`tg init`).** `tg-trace` links OpenSpec requirements to code, tests and docs and runs the trace; `tg-impact` finds the requirements, scenarios, tests and docs a code change touches, before and after the edit; `tg-audit` audits specs against code and turns drift into an OpenSpec change and annotations. `tg-graph` now covers `Requirement` and `Scenario` nodes.
- **OpenSpec skills become tg-aware.** When OpenSpec's propose, apply, archive or explore skills (`.claude/skills/openspec-*`) or `/opsx` commands exist, `tg init` appends a `<!-- tg:begin -->` block with the tg steps for that stage: stable requirement names when proposing, `implements` and `verifies` while applying, `tg trace --gaps` and `tg check` around archiving. Re-running after `openspec update` restores the block; `--no-openspec` skips it.
- `tg init --skills-only` writes only the skills and OpenSpec blocks, for projects that keep their own instruction files and hooks. `tg gen` prints every skill and block.

## 0.10.0 — 2026-10-08

### Added

- **OpenSpec traceability (`tg`).** `tg` reads `openspec/specs/` and open changes, and code and tests point at requirements and scenarios with `@tg: implements:: [[openspec:<capability>#<Requirement>]]` and `@tg: verifies:: [[openspec:<capability>#<Requirement>#<Scenario>]]`. A `@tg:` comment above `it(...)` attaches to that test and records its name. lat.md files list the capabilities they explain as `openspec: [...]` in frontmatter.
- **`tg trace [capability...] [--gaps] [--strict] [--json]`** reports, per requirement, the implementing code, the tests that verify each scenario and the explaining docs; `--strict` exits 1 on gaps, for CI. `tg cypher` gains `Requirement` and `Scenario` nodes, and the MCP server a `tg_trace` tool.
- `tg check` rejects `openspec:` targets and frontmatter entries that do not resolve, with a did-you-mean suggestion. Missing traceability is never a check finding.
- Sidecar MCP `vector_search` accepts the `then` follow-up query, `mode` and `backend`, as REST does.
- Specs for typed note creation, the ontology gallery, the plugin install check and the example vault; the requirements of every capability were audited against the code and realigned.

### Fixed

- **Embedding dimension change.** Search and retrieve refuse with a rebuild message when the active model's vector size differs from the index, instead of scoring with NaN; `cosine` throws on vectors of different length. Retrieve flags a stale index like search does.
- **Unresponsive embedding provider.** Requests time out after 30 seconds (`OBSIGRAPH_EMBED_TIMEOUT_MS`), so `tg search` falls back to lexical results instead of hanging. Empty or uneven-length vectors are rejected as a bad response.
- **Key precedence.** `TG_EMBED_KEY`, `TG_EMBED_KEY_FILE` and `TG_EMBED_KEY_HELPER` now win over the `LAT_LLM_KEY*` aliases.
- **SHACL import** warns when a template body cannot be written to an existing note instead of dropping it.
- **Ladybug mirror.** A corrupt database is discarded and rebuilt instead of stopping the sidecar, and a failed sync is reported instead of serving the old snapshot.
- **Cypher.** List and pattern comprehensions, map projections, pattern predicates and `EXISTS`/`COUNT`/`COLLECT {}` subqueries are reported as unsupported by name, not as syntax errors, and pass through to Ladybug. A variable-length relationship variable is a list column.
- `retrieve` caps its total returned text and sets `truncated`; the sidecar MCP server reports its real version.
- `tg section`, `refs` and `expand` print one JSON document under `--json` when nothing matches.

## 0.9.1 — 2026-10-08

### Fixed

- **Community review findings (plugin).** `main.js` no longer contains dynamic code: the build replaces the `Function('return this')()` fallback that cytoscape inlines from lodash, and the Cypher evaluator's `eval` method is renamed `evaluate`. Three lint warnings in the core library are fixed (an unneeded non-null assertion, `globalThis.crypto`, an untyped `Map`).

### Added

- **Install check.** `npm run check:install` (`scripts/check-plugin-install.mjs`) repeats Obsidian's installer downloads against the latest release. It runs as the last release step and every six hours in `.github/workflows/install-check.yml`.
- OpenSpec proposal for AsciiDoc notes (`openspec/changes/asciidoc-notes`).

## 0.9.0 — 2026-10-08

### Added

- **Typed Graph Schema 0.2: ids and template tokens.** A type can declare `id` rules (`uuid`, time-ordered `uuid7`, `timestamp`, `luhmann`), each stored in its own property, with `auto` and `filename` options. Templates may use `{{title}}`, `{{date}}`, `{{time}}`, `{{id}}`, `{{<id property>}}`, `{{parent}}`, `{{parent-id}}` and `{{parent-link}}`. TGS 0.1 stays published; every 0.1 schema note is valid 0.2.
- **New typed note menu (plugin).** The command *New typed note*, a ribbon menu with one entry per type, and *New typed note here* in the folder menu replace *Create note from type*. *New child note*, *New sibling note* and *New top-level note* create Luhmann ids from the active note.
- **Zettelkasten ontology.** Fleeting, literature, permanent, structure and project notes, book and article sources with writers, highlights and topics, a `uid` for every type, optional Luhmann ids on permanent notes, one template per note type and new examples. *Breaking for existing users of the gallery ontology:* `Zettel` and `stage` are replaced by the note types, and `Source` by `BookSource` and `ArticleSource`.
- **Website.** New home page, Agents, Obsidian, Teams, Install and Compare pages, launch articles, demo clips, and on the ontology page a Zettelkasten walkthrough and schema maps of every ontology.

### Changed

- The core library, `tg` and the sidecar read TGS 0.2; `tg` itself has no new commands.

## 0.8.0 — 2026-10-07

### Added

- **Code ontology in `tg init`.** `tg init --write` now also writes `lat.md/code-ontology.md`, a guide to six intent types (Decision, Requirement, Scenario, Constraint, Concept, Change) and eleven edge types (`implements`, `verifies`, `-contradicts`, `supersedes`, `motivated_by`, `constrains`, `refines`, `depends_on`, `defines`, `introduced_by`, `changed_by`), and `ontology/code-types.md`, the same vocabulary as a TGS schema that exports to SHACL (`tg schema export shapes.ttl --schema-folder ontology`). The note is appended to the lat.md index; neither file is overwritten on a later run. `--no-ontology` skips both, and `tg gen ontology.md` / `ontology-schema.md` print them.
- **File types label sections.** A `type:` in a lat.md file's frontmatter (scalar, inline list or block list) labels every section below the title, so `tg cypher` can match `(s:Requirement)` or `(s:Decision)`.
- **Ontology gallery.** `ontologies/` holds four downloadable ontologies as plain Markdown vaults (Zettelkasten, book management, requirements and coding, prompts and agents) plus a shared `core` that declares edge types several of them use, so they can be combined. The website has a gallery page with downloads and usage (`ontologies.html`; zips built by `npm run site:ontologies`) and an article on composing ontologies with a shared core, multi-label notes and mixins.
- Articles: the coding-ontology article is extended and a new one covers using the ontology by role.

### Changed

- The agent instruction block and the `tg-graph` skill mention the ontology vocabulary.
- `.gitignore` skips the rendered `articles/*.html`, whose code samples contain `@tg:` examples that `tg check` read as real annotations.

## 0.7.1 — 2026-10-06

Fixes for the community review of 0.7.0.

### Changed

- Release assets `main.js` and `styles.css` carry GitHub build-provenance attestations.
- Lint cleanups: unnecessary regex escapes, a control character in the SHACL exporter's IRI escaping, redundant type assertions, and an inline style in the VS Code graph webview.

## 0.7.0 — 2026-10-06

Typed Graph Schema (TGS) 0.1 and SHACL interop. See [An ontology you can edit by hand](https://volland.github.io/obsigraph/blog-typed-graph-schema.html) and the [specification](https://volland.github.io/obsigraph/spec/tgs/v0.1/).

### Added

- **Several types in one schema note.** `schemas:` declares any number of types, so one note can describe a whole subsystem; `schema:` (the type named by the note title) still works and both can be combined. A type declared twice uses the first by path and reports both notes.
- **Edge types.** `edgeTypes:` declares an edge type with `from`, `to`, its own `properties`, `uri` and `visualization`. Edge properties, required edge properties and edge endpoint types are validated.
- **Richer edges and properties.** `edges` accepts a map (`worksAt: Company`, or `{target, many, required}`); properties gain `many`, `values` and `uri`, and the kinds `datetime` and `list`. IRIs and CURIEs with built-in and declared prefixes, and a `tgs:` version key.
- **Templates.** A type can link a template note with `template:`; a type with no template gets one generated from its schema.
- **SHACL.** `tg schema export <out.ttl>` and `tg schema import <file.ttl>`, and the plugin commands *Export schemas as SHACL* and *Import SHACL shapes*. Export is deterministic and round-trips losslessly; import reports every construct outside the supported subset and never deletes notes. New setting: Schema base IRI.
- **An open specification.** [TGS 0.1](https://volland.github.io/obsigraph/spec/tgs/v0.1/) with a JSON Schema, conformance examples and the `tgs:` namespace page.

### Changed

- An `edgeTypes` entry's `visualization` styles that edge type and wins per attribute over a type's `visualization.edges`.
- Schema `edges` are now rules internally; code that used `TypeSchema.edges` as a string list should use `edgeNames()`.

## 0.6.0 — 2026-10-06

Open Knowledge Format (OKF v0.2) compatibility. See [Getting your vault OKF-ready](https://volland.github.io/obsigraph/blog-okf-ready.html).

### Added

- **Markdown link targets in edges.** `knows:: [Bob](/people/bob.md) {since: 2020}` is a typed edge, alone or mixed with wikilinks. Paths from the vault root (`/x.md`) and relative paths (`./x.md`, `../x.md`) resolve, percent escapes are decoded, and links to web pages are never edges. Works in the plugin, the sidecar and the CLI.
- **`tg export <out> --format okf`.** Writes a conformant OKF bundle. Wikilinks become markdown links from the bundle root, and typed edge lines keep their type, sign and properties, so tg reads the bundle back into the same graph. Every concept gets a string `type` (`--default-type`, default `Note`), plus a `title` and `description` when missing. Notes named `index.md` or `log.md` are renamed, embedded attachments are copied, and every folder gets an `index.md` (only the root one declares `okf_version: "0.2"`). The command prints a change report and verifies the output.
- **`tg okf check [dir]`.** Checks any folder against OKF conformance. It exits 1 only on conformance errors; broken links, wikilinks and missing descriptions are warnings. Supports `--json`.
- **Plain link edges (opt-in).** With `OBSIGRAPH_LINK_EDGES=1`, the sidecar turns every plain link in prose into an untyped `links_to` edge, which is how OKF reads links, so third-party bundles load as connected graphs. It is off by default.

### Changed

- A non-empty frontmatter `title` now becomes the node's `title`; before, the file name always overwrote it.
- A frontmatter `types` list adds node labels after those from `type`.
- The CLI bundle now loads bundled CommonJS dependencies through `createRequire`.

## 0.5.0 — 2026-10-04

- The `tg` CLI: a drop-in replacement for lat.md with typed `@tg:` code annotations, openCypher over docs and code, lexical search, agent setup, and `export` / `import`.
- The code layer: annotated source symbols as graph nodes in the plugin and the CLI.
- lat.md folders read in place inside an Obsidian vault.
