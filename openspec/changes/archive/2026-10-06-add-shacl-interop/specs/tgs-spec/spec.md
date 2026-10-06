## Purpose

Publishes the schema-note YAML format as an open, versioned specification, Typed Graph Schema (TGS), so other tools can read, validate and write the same ontologies without depending on this project's code.

## ADDED Requirements

### Requirement: Published specification
The project SHALL publish TGS v0.1 as a standalone document covering schema note location, the `schema:`, `schemas:` and `edgeTypes:` forms, properties, edges, identifiers and prefixes, templates, advisory validation semantics, the SHACL mapping and conformance levels, at a stable versioned URL on the project website, with the source kept in the repository.

#### Scenario: Spec reachable at a versioned URL
- **WHEN** the website is published
- **THEN** the TGS v0.1 specification is reachable at a URL containing `spec/tgs/v0.1/`

#### Scenario: Spec is self-contained
- **WHEN** a reader has only the published specification
- **THEN** it defines every key a schema note may use and the meaning of each, without reference to plugin source code

### Requirement: Machine-readable schema
The project SHALL publish a JSON Schema (draft 2020-12) for the TGS frontmatter keys next to the specification, and every example in the specification and the schema scaffold SHALL validate against it.

#### Scenario: Examples validate
- **WHEN** the test suite runs
- **THEN** every example schema note in the specification validates against the published JSON Schema

#### Scenario: Invalid note rejected
- **WHEN** a frontmatter block uses `edges: 5`
- **THEN** it fails validation against the JSON Schema

### Requirement: Namespace IRI
The project SHALL define the `tgs:` namespace IRI used for annotations in SHACL exports, and that IRI SHALL resolve to a page documenting each term.

#### Scenario: Namespace documented
- **WHEN** a user opens the `tgs:` namespace IRI in a browser
- **THEN** a page lists `tgs:note`, `tgs:template`, `tgs:visualization` and `tgs:edgesClosed` with their meaning

### Requirement: Conformance levels
The specification SHALL define three conformance levels, reader (parses every key), validator (reader plus the advisory diagnostics) and SHACL exchanger (validator plus the export and import mapping), and SHALL include example notes with the expected parse result and diagnostics for each level.

#### Scenario: Conformance examples shipped
- **WHEN** an implementer downloads the specification bundle
- **THEN** it contains example notes paired with the expected parse result and diagnostics

### Requirement: Versioning
A schema note MAY declare `tgs: "<major>.<minor>"`. A reader SHALL read notes declaring a newer minor version of the same major version and SHALL report keys it does not know; it SHALL report a note declaring a different major version and ignore its schema. Published versions SHALL never change after publication.

#### Scenario: Newer minor version
- **WHEN** a note declares `tgs: "0.2"` and uses an unknown key
- **THEN** a v0.1 reader reads the known keys and reports the unknown one

#### Scenario: Different major version
- **WHEN** a note declares `tgs: "1.0"` and the reader implements 0.x
- **THEN** the reader reports the version and does not use that note's schema

### Requirement: Host independence
The specification SHALL be implementable outside Obsidian: link-valued keys such as `template` SHALL accept a wikilink, a markdown link or a vault-relative path, and the schema folder SHALL be a configurable default.

#### Scenario: Markdown link template
- **WHEN** a type declares `template: "[Person](../Templates/Person.md)"`
- **THEN** a conforming reader resolves it to `Templates/Person.md`
