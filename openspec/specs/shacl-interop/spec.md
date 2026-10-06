# shacl-interop Specification

## Purpose
Exchanges vault schemas with the RDF world: exports schema notes as W3C SHACL shapes in Turtle and imports SHACL shapes back into schema notes, lossless for the Typed Graph Schema subset and with a report for everything else.

## Requirements

### Requirement: Export schemas as SHACL
The system SHALL export every type and edge type in the schema folder as one SHACL document in Turtle, from the CLI (`tg schema export <out.ttl> --format shacl [--vault dir] [--base iri]`) and from a plugin command, and the output SHALL be deterministic so unchanged schemas produce byte-identical files.

#### Scenario: Export from the CLI
- **WHEN** the user runs `tg schema export shapes.ttl --format shacl` in a vault with `Person` and `Company` schemas
- **THEN** `shapes.ttl` contains one node shape per type and parses as valid Turtle

#### Scenario: Deterministic output
- **WHEN** the export runs twice without schema changes
- **THEN** both files are byte-identical

#### Scenario: Empty schema folder
- **WHEN** the vault has no schema notes
- **THEN** the export writes a document with prefixes only and reports that no types were found

### Requirement: Node type mapping
The system SHALL export each type as a `sh:NodeShape` whose `sh:targetClass` is the type's `uri` or the base IRI plus the type name, and each property as a property shape with `sh:path`, a datatype from its kind (text → `xsd:string`, number → `xsd:decimal`, boolean → `xsd:boolean`, date → `xsd:date`, datetime → `xsd:dateTime`, link → `sh:nodeKind sh:IRI`, list → `xsd:string` with many), `sh:minCount 1` when required, `sh:maxCount 1` unless many, `sh:defaultValue` for a default and `sh:in` for `values`.

#### Scenario: Property shape exported
- **WHEN** `Person` declares `email: {kind: text, required: true}`
- **THEN** the Person shape has a property shape with path `email`, datatype `xsd:string`, `sh:minCount 1` and `sh:maxCount 1`

#### Scenario: Declared URI used
- **WHEN** `Company` declares `uri: schema:Organization`
- **THEN** the Company shape's target class is `https://schema.org/Organization`

### Requirement: Edge mapping
The system SHALL export each per-type edge entry as a property shape on the source type's shape with `sh:path` the edge type's IRI, `sh:class` the target type's class when a target is declared, `sh:minCount 1` when required and `sh:maxCount 1` unless many, and SHALL mark a type with an `edges` declaration with `tgs:edgesClosed true`.

#### Scenario: Edge with target exported
- **WHEN** `Person` declares `worksAt: Company`
- **THEN** the Person shape has a property shape with path `worksAt` and `sh:class` the Company class, and no `sh:maxCount`

### Requirement: Edge type shapes
The system SHALL export each edge type that declares `from`, `to` or properties as a node shape for its RDF reification: property shapes on `rdf:subject` with `sh:class` for `from`, on `rdf:object` with `sh:class` for `to`, on `rdf:predicate` with `sh:hasValue` the edge type's IRI, and one property shape per edge property using the node property mapping.

#### Scenario: Edge properties exported
- **WHEN** `worksAt` declares `from: Person`, `to: Company` and property `since: date`
- **THEN** the document has a shape constraining `rdf:predicate` to `worksAt`, `rdf:subject` to Person, `rdf:object` to Company, and `since` to `xsd:date`

### Requirement: Typed Graph annotations
The system SHALL keep what SHACL cannot express as annotations in the `tgs:` namespace on the shape: the source note (`tgs:note`), the template body or link (`tgs:template`) and the visualization block (`tgs:visualization`, a JSON literal), and other SHACL consumers SHALL be able to ignore them without changing validation results.

#### Scenario: Visualization preserved
- **WHEN** `Person` declares `visualization: {color: "#3b82f6"}`
- **THEN** the Person shape carries a `tgs:visualization` literal containing that color

### Requirement: Import SHACL into schema notes
The system SHALL import a SHACL Turtle file into the schema folder from the CLI (`tg schema import <file.ttl> [--vault dir] [--layout per-type|single] [--into name] [--force]`) and from a plugin command, creating one note per type by default or all types in one note with `--layout single`, and grouping by `tgs:note` when present. Updating SHALL replace only the schema declarations of the imported types and keep each note's body and other frontmatter.

#### Scenario: One note per type
- **WHEN** the user imports a file with shapes for `Person` and `Company`
- **THEN** `Types/Person.md` and `Types/Company.md` are created, each with `schema:`

#### Scenario: Single note layout
- **WHEN** the user imports the same file with `--layout single --into Org`
- **THEN** `Types/Org.md` is created with `Person` and `Company` under `schemas:`

#### Scenario: Existing body kept
- **WHEN** `Types/Person.md` exists with a body and the import contains `Person`
- **THEN** its schema declaration is replaced and its body is unchanged

### Requirement: Reverse mapping
The system SHALL read a node shape with `sh:targetClass` as a type named by `sh:name` or the class IRI's local name, a property shape with `sh:datatype` or `sh:nodeKind sh:IRI` as a property, a property shape with `sh:class` or `sh:node` as an edge, and a shape constraining `rdf:predicate` with `sh:hasValue` as an edge type, writing a `uri` whenever the IRI differs from the base IRI plus the name.

#### Scenario: External shape imported
- **WHEN** a file declares a shape targeting `schema:Person` with a property shape on `schema:email` with `sh:datatype xsd:string`
- **THEN** the imported `Person` type has `uri: schema:Person` and a text property `email` with `uri: schema:email`

### Requirement: Drop report
The system SHALL list every SHACL construct outside the supported subset (such as `sh:or`, `sh:sparql`, qualified value shapes, `sh:pattern`, property paths other than a single IRI, and unknown datatypes, which become text) with the shape it came from, SHALL import everything else, and SHALL exit with code 0 when the import succeeded even if items were dropped.

#### Scenario: Unsupported construct reported
- **WHEN** an imported shape uses `sh:or`
- **THEN** the report names the shape and `sh:or`, and the rest of that shape is imported

### Requirement: Lossless round trip
The system SHALL reproduce, for schemas written in the Typed Graph Schema format, the same types, edge types, properties, edges, identifiers, templates and visualization after an export followed by an import, and the same Turtle after a second export.

#### Scenario: Export import export
- **WHEN** a vault's schemas are exported, imported into an empty vault and exported again
- **THEN** both Turtle files are byte-identical

### Requirement: Imports never clobber silently
The system SHALL refuse to change a schema note that declares types not present in the import, unless `--force` is given, and SHALL never delete schema notes.

#### Scenario: Mixed note protected
- **WHEN** `Types/Org.md` declares `Person` and `Team` and the import contains only `Person`
- **THEN** the import reports the conflict and leaves `Types/Org.md` unchanged
