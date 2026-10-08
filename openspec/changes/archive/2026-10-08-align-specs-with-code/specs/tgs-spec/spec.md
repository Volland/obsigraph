## MODIFIED Requirements

### Requirement: Published specification
The project SHALL publish the current TGS version, 0.2, as a standalone document covering schema note location, the `schema:`, `schemas:` and `edgeTypes:` forms, properties, edges, identifiers and prefixes, the `id` key for identifiers of new notes, templates and template tokens, advisory validation semantics, the SHACL mapping and conformance levels, at a stable versioned URL on the project website, with the source kept in the repository and every earlier version kept unchanged in the repository archive.

#### Scenario: Spec reachable at a versioned URL
- **WHEN** the website is published
- **THEN** the TGS 0.2 specification is reachable at a URL containing `spec/tgs/v0.2/` and TGS 0.1 at a URL containing `spec/tgs/v0.1/`

#### Scenario: Spec is self-contained
- **WHEN** a reader has only the published specification
- **THEN** it defines every key a schema note may use and the meaning of each, without reference to plugin source code

#### Scenario: Earlier version compatible
- **WHEN** a schema note valid under TGS 0.1 is read by a TGS 0.2 reader
- **THEN** it reads with the same types, properties and edges and no new diagnostics

### Requirement: Namespace IRI
The project SHALL define the `tgs:` namespace IRI used for annotations in SHACL exports, and that IRI SHALL resolve to a page documenting each term listed in `spec/tgs/namespace.json`.

#### Scenario: Namespace documented
- **WHEN** a user opens the `tgs:` namespace IRI in a browser
- **THEN** a page lists `tgs:note`, `tgs:template`, `tgs:templateBody`, `tgs:visualization`, `tgs:edgesClosed`, `tgs:edge`, `tgs:kind` and `tgs:default` with their meaning

### Requirement: Versioning
A schema note MAY declare `tgs: "<major>.<minor>"`; a note without it SHALL be read as version 0.1. A reader SHALL read notes declaring a newer minor version of the same major version and SHALL report keys it does not know; it SHALL report a note declaring a different major version and ignore its schema. Published versions SHALL never change after publication.

#### Scenario: Newer minor version
- **WHEN** a note declares `tgs: "0.3"` and uses an unknown key
- **THEN** a 0.2 reader reads the known keys and reports the unknown one

#### Scenario: Different major version
- **WHEN** a note declares `tgs: "1.0"` and the reader implements 0.x
- **THEN** the reader reports the version and does not use that note's schema

## ADDED Requirements

### Requirement: Archived versions and latest redirect
The website build SHALL publish the current version and every archived version under `spec/tgs/v<version>/` with their source files, SHALL publish archived versions byte-for-byte from `spec/tgs/archive/`, and `spec/tgs/` SHALL redirect to the current version.

#### Scenario: Latest redirect
- **WHEN** a user opens `spec/tgs/` on the website
- **THEN** the browser is sent to `spec/tgs/v0.2/`

#### Scenario: Archive unchanged
- **WHEN** the site is built after TGS 0.2 was published
- **THEN** the files under `spec/tgs/v0.1/` equal those in `spec/tgs/archive/v0.1/`
