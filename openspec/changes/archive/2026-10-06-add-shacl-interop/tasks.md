## 1. Schema model and reader

- [x] 1.1 Extend types in core: `PropertySchema` (`many`, `values`, `uri`, kinds `datetime` and `list`), `EdgeRule`, `EdgeTypeSchema`, `SchemaSet.edgeTypes`, prefixes
- [x] 1.2 Implement `readSchemaNote` for `schema:`, `schemas:`, `edgeTypes:`, `prefixes:` and `tgs:` version, keeping `readSchema` behavior for existing notes
- [x] 1.3 Collect schemas in path order with duplicate diagnostics for types, edge types and prefixes; expand CURIEs and report unknown prefixes
- [x] 1.4 Update `mergeSchemas` for edge rules (union targets, any required) and add `edgeNames` for existing callers

## 2. Validation

- [x] 2.1 Validate `values` and `many` on node properties
- [x] 2.2 Validate required and single edges per type
- [x] 2.3 Validate edge properties (required, `values`) at the edge line
- [x] 2.4 Validate edge endpoints (`targets`/`to`, `from`), skipping stubs and untyped notes

## 3. Templates

- [x] 3.1 Resolve `template` links (wikilink, markdown link, path) and apply the precedence link → `schema:` body → generated
- [x] 3.2 Implement `renderTemplateFromSchema` and verify placeholder edge lines produce no edges
- [x] 3.3 Update the scaffold and the "Create note from type" command to list types from every form

## 4. Visualization

- [x] 4.1 Read edge styles from `edgeTypes.<name>.visualization` in `style.ts` with per-attribute precedence over `visualization.edges`

## 5. SHACL export and import (core)

- [x] 5.1 Add `n3` to core and create `packages/core/src/shacl/` with the TGS ↔ SHACL mapping tables
- [x] 5.2 Implement deterministic `exportShacl(schemaSet, {base})`: node shapes, property and edge shapes, reification shapes, `tgs:` annotations
- [x] 5.3 Implement `importShacl(turtle, {base})` returning declarations grouped into notes plus the drop report
- [x] 5.4 Implement note writing for import: per-type and single layouts, shorthand serialization, update of schema keys only, mixed-note protection

## 6. CLI and plugin

- [x] 6.1 Add `tg schema export <out.ttl> --format shacl [--vault] [--base]` and `tg schema import <file.ttl> [--vault] [--layout] [--into] [--force]` with reports and exit codes
- [x] 6.2 Add plugin commands "Export schemas as SHACL" and "Import SHACL shapes" (dynamic import of the shacl module) and the `schemaBaseIri` setting

## 7. TGS specification

- [x] 7.1 Write `spec/tgs/SPEC.md` v0.1: forms, keys, defaults, validation semantics, SHACL mapping, conformance levels, versioning, licensing
- [x] 7.2 Write `spec/tgs/tgs.schema.json` (JSON Schema 2020-12) for the frontmatter keys
- [x] 7.3 Add `spec/tgs/examples/` notes with expected parse results and diagnostics per conformance level
- [x] 7.4 Publish via `site/build.mjs` to `site/spec/tgs/v0.1/` with a rendered spec page and the `ns/tgs/` namespace page; link from docs

## 8. Tests

- [x] 8.1 Write tests covering every scenario in the schema-notes and visualization-config deltas
- [x] 8.2 Write tests covering every scenario in shacl-interop, including the byte-identical round trip and an external schema.org shapes file
- [x] 8.3 Write tests that validate every spec example and the scaffold against the JSON Schema (`ajv` dev dependency) and run the conformance examples through the core reader

## 9. Docs and sync

- [x] 9.1 Add a multi-type schema note with an edge type to the example vault and keep the example-vault test green
- [x] 9.2 Update `lat.md/graph-model.md` and `visualization.md`, add `lat.md/shacl.md` and test-spec sections with `@lat:` refs; update the CLI docs and the website docs, and add a blog article
- [x] 9.3 Run `lat check`, `openspec validate add-shacl-interop --strict` and the full test suite
