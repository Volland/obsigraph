## Why

Schema notes are a private YAML dialect: one type per note, edges as a bare allow-list with no target type, no way to describe edge properties, and nothing other tools can read. Users want to design a whole subsystem in one note, keep the format simple enough to maintain by hand, and exchange ontologies with the RDF world through SHACL, so the format itself should become a small published open specification rather than an implementation detail.

## What Changes

- A schema note may declare several node types under `schemas:` (type name → schema), so one note can describe a subgraph or subsystem; `schema:` (type named by the note title) keeps working and both may appear together. A type declared twice raises a diagnostic and the first by path wins.
- Edge shapes: a note may declare edge types under `edgeTypes:` with `from`, `to`, `many`, `required`, `uri`, `visualization` and their own `properties`, which validate edge property blocks such as `{since: 2020}`.
- Per-type `edges` accept a map form `worksAt: Company` (target type) or `{target, many, required}`; the list form stays valid and means "any target".
- Properties gain `many` (list values), `values` (enum), `uri`, and the kinds `datetime` and `list`, aligned with Obsidian property types.
- Types, properties and edge types accept an optional `uri` (full IRI or a CURIE with built-in prefixes such as `schema:`); a vault base IRI setting names everything else.
- Templates: a type may point to a template note with `template: "[[...]]"`; when a type has neither a body template nor a template note, "Create note from type" generates one from the schema (frontmatter placeholders for every property, a heading and an edge line stub per declared edge).
- SHACL interop: `tg schema export --format shacl` and a plugin command write SHACL Turtle for the whole schema folder; `tg schema import <file.ttl>` and a plugin command create or update schema notes, one note per shape (default) or a single note, and print a report of every SHACL construct outside the supported subset. Round trip is lossless for anything written in the YAML format.
- Publish the YAML format as an open, versioned specification, **Typed Graph Schema (TGS) v0.1**: a standalone `SPEC.md`, a JSON Schema (2020-12) for the frontmatter block, the SHACL mapping table, conformance examples, and a stable namespace IRI for TGS annotations, all served from the website under a versioned URL.

No breaking changes: every existing schema note parses and validates as before.

## Capabilities

### New Capabilities
- `shacl-interop`: export of schemas to SHACL Turtle, import of SHACL shapes into schema notes, the mapping between them, edge shapes as reified relationship shapes, and the drop report.
- `tgs-spec`: the published Typed Graph Schema specification, its JSON Schema, conformance examples, namespace IRI and versioning rules.

### Modified Capabilities
- `schema-notes`: multi-type notes, duplicate handling, edge map form, edge types with properties and endpoint validation, new property attributes and kinds, `uri`, template notes and schema-generated templates.
- `visualization-config`: an edge type's `visualization` inside `edgeTypes` becomes a style source at the schema-note level, alongside the existing `visualization.edges` map.

## Impact

- `packages/core/src/schema/` — reader for both forms, edge types, new validation, generated templates; new `shacl/` module for export, import and the mapping.
- `packages/core/src/style/style.ts` — read edge-type visualization from `edgeTypes`.
- `packages/plugin/src/schema-commands.ts`, `settings.ts` — import/export commands, base IRI setting, template generation.
- `packages/cli` — new `tg schema export|import` commands.
- New dependency: `n3` (pure JS Turtle reader/writer) in core.
- New top-level `spec/tgs/` (SPEC.md, `tgs.schema.json`, examples), copied to `site/spec/tgs/v0.1/` with a rendered spec page and a namespace page; website docs and a blog article.
- `lat.md/graph-model.md`, `visualization.md`, new `lat.md/shacl.md`, test specs; example vault gains a multi-type schema note and edge type.
