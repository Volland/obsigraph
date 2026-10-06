## Context

Schemas are read by `readSchema` in `packages/core/src/schema/schema.ts`: one `TypeSchema` per note in the schema folder, type name from the title, `edges` as a string list, `visualization`/`style` passed raw to `style.ts`. `schemasFromGraph` builds a `Map<type, TypeSchema>` from graph nodes, so schema reading already runs in core and is shared by the plugin, CLI and sidecar. Edge property blocks are parsed into `edge.props`. Validation is advisory and never removes graph content. The CLI already has an export pipeline (`tg export --format okf`) with loss reports, which the SHACL commands follow. See proposal.md for motivation and the specs for the required behavior.

## Goals / Non-Goals

**Goals:**
- One reader producing a `SchemaSet` of node types and edge types from any mix of `schema:`, `schemas:` and `edgeTypes:` notes, with no behavior change for existing notes.
- A pure, host-free SHACL mapping in core, used by the CLI and the plugin.
- A TGS specification and JSON Schema that are the normative source, with the core reader tested against the spec's conformance examples.

**Non-Goals:**
- Type checking property values against their kind (a `number` property holding text). Only `values`, `many` and `required` are checked in this change.
- Inheritance (`extends`), OWL export, SHACL-SPARQL, SHACL 1.2 / RDF 1.2 reifiers.
- Validating RDF data with SHACL; the vault is still validated by our own advisory rules.
- JSON-LD export of notes (a natural follow-up that reuses the same IRIs).

## Decisions

**1. One `SchemaSet` with two maps.** `SchemaSet` gains `edgeTypes: Map<string, EdgeTypeSchema>` beside `schemas`. `readSchemaNote(path, frontmatter)` returns every declaration in a note, each tagged with its source path; `schemasFromGraph` sorts notes by path and keeps the first declaration of a name, adding a duplicate diagnostic. Alternative: keep one `readSchema` per type and call it per key. Rejected because duplicates, prefixes and `edgeTypes` are note-level concerns.

**2. Edge entries normalized to one shape.** `TypeSchema.edges` becomes `EdgeRule[] | null` with `{type, targets: string[] | null, many, required}`. The list form maps to `{targets: null, many: true, required: false}`. `mergeSchemas` unions rules by type, unioning targets and taking `required` if any label requires it. Callers that only need names (`style.ts`, query hints) use a helper `edgeNames(schema)`.

**3. Edge defaults differ from property defaults.** Properties default to `many: false` because frontmatter values are usually scalar. Edges default to `many: true` because repeated edges of one type are normal (`knows`). Writing the defaults this way keeps the shorthands (`born: date`, `worksAt: Company`) correct without extra keys. The spec states both defaults explicitly.

**4. Edge properties via standard RDF reification in SHACL.** An edge type's shape constrains `rdf:subject`, `rdf:predicate` (`sh:hasValue`) and `rdf:object` plus the edge properties. This is valid SHACL 1.0 over the RDF reification vocabulary, so any SHACL engine accepts it, and import recognizes the pattern even in foreign files. Alternatives: RDF-star / RDF 1.2 reifiers (not yet stable in SHACL), or a custom `tgs:EdgeShape` class (not interoperable). The per-type edge stays a plain property shape on the source shape, so simple consumers see `Person —worksAt→ Company` directly.

**5. Allow-list as `tgs:edgesClosed`.** `sh:closed` would also close frontmatter properties, which are open in TGS. Exporting `tgs:edgesClosed true` keeps SHACL validation results unchanged for other engines, and round trips exactly. Documented as the one semantic gap.

**6. IRIs.** The default base IRI is `urn:tgs:` + type, property or edge name (for example `urn:tgs:Person`). It is overridable by the plugin setting `schemaBaseIri` and the CLI flag `--base`. `uri` accepts a full IRI or a CURIE. Prefixes are the built-in set plus a vault-wide `prefixes:` key collected from all schema notes; conflicting prefix definitions raise a duplicate diagnostic like types. The `tgs:` namespace is `https://volland.github.io/obsigraph/ns/tgs#`, served by a static page on the website (GitHub Pages serves `ns/tgs/index.html`; the `#` fragment resolves to it).

**7. Turtle via `n3`.** `n3` is pure JS, small, has no native code, and parses and writes Turtle with prefixes, so it bundles into the Obsidian plugin and the VS Code extension. Deterministic output comes from sorting shapes by target IRI and property shapes by path before writing, using blank-node property lists rather than generated blank-node ids. Alternative: hand-written Turtle writer plus `rdflib`. Rejected because rdflib is heavy and a hand-written parser is error-prone.

**8. Import writes YAML through the existing frontmatter writer.** Import builds the same declaration objects the reader produces and serializes them with shorthands where lossless (`born: date`, `worksAt: Company`), so imported notes look hand-written. Updating a note rewrites only `schema`/`schemas`/`edgeTypes`/`prefixes` keys and keeps the remaining frontmatter and body byte-for-byte. Grouping order: `tgs:note`, else `--layout`.

**9. Generated templates are a pure function.** `renderTemplateFromSchema(type, schemaSet)` emits frontmatter placeholders (default, `[]` for many, empty otherwise) and a `## Relations` section with one `- <edge>:: ` line per declared edge. An empty target is not an edge for the parser, which is verified by a test, so the placeholder never creates stub nodes. Precedence: `template` link, then the `schema:` note body if non-empty, then the generated template. A `schemas:` note's body is always documentation.

**10. Spec lives in `spec/tgs/`, website copies it.** `spec/tgs/SPEC.md`, `spec/tgs/tgs.schema.json` and `spec/tgs/examples/*` (note + expected JSON) are the sources. `site/build.mjs` copies them to `site/spec/tgs/v0.1/` and renders `SPEC.md` to an HTML page in the site style. Core tests load the examples and the JSON Schema (validated with `ajv`, a dev dependency only) so spec and implementation cannot drift. Licensing: spec text CC BY 4.0, JSON Schema and examples MIT, stated in the spec header.

## Risks / Trade-offs

- [Reification shapes look unfamiliar to RDF users who model edge properties with RDF-star] → The spec explains the choice and the plain property shape on the source keeps the common case readable. Switching to reifiers later is a TGS minor version.
- [Endpoint validation adds noise in partly typed vaults] → Untyped and stub targets are never reported, and all diagnostics stay advisory.
- [Duplicate-by-path rule can surprise when notes are renamed] → The diagnostic names both notes so the user sees which one won.
- [Import can rewrite a note the user hand-formatted] → Only schema keys are rewritten. Mixed notes are protected without `--force`, and nothing is ever deleted.
- [`n3` adds bundle size to the plugin] → It is about 100 KB minified and loaded only by the import and export commands via dynamic import.
- [Publishing a spec creates a compatibility promise] → Published versions are immutable and the versioning rules in the spec define what a minor bump may add.

## Migration Plan

None required: existing notes parse unchanged, and the list form of `edges` keeps its meaning. Rollback is reverting the release. Notes written with new keys are read by older plugin versions with the new keys ignored, except that the map form of `edges` produces an "`edges` must be a list" diagnostic there.
