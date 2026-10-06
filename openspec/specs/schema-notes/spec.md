# schema-notes Specification

## Purpose
Defines optional schema notes that declare a type's properties, defaults, allowed edge types and template, and the command that creates a note from a type, so vault structure can be typed without making the graph depend on it.

## Requirements

### Requirement: Schema notes are discovered by location
The system SHALL treat each markdown note directly in the configured schema folder (default `Types/`) as a schema note, and SHALL work normally when no schema notes exist. A schema note SHALL declare the type named by its title under `schema:`, any number of types under `schemas:` (a mapping from type name to schema), edge types under `edgeTypes:`, or any combination of these, so one note can describe a single type or a whole subgraph.

#### Scenario: Schema found for a type
- **WHEN** the note `Types/Person.md` declares `schema:` and a note has `type: Person`
- **THEN** the schema for `Person` is available for that note

#### Scenario: Several types in one note
- **WHEN** `Types/People and Orgs.md` declares `schemas:` with keys `Person` and `Company`
- **THEN** schemas for both `Person` and `Company` are available and no type named `People and Orgs` exists

#### Scenario: Both forms in one note
- **WHEN** `Types/Person.md` declares `schema:` and also `schemas:` with key `Address`
- **THEN** schemas for both `Person` and `Address` are available

#### Scenario: Notes outside the folder are ignored
- **WHEN** a note in `Types/archive/` or outside `Types/` declares `schemas:`
- **THEN** none of its types are read as schemas

#### Scenario: No schemas present
- **WHEN** the schema folder is missing or empty
- **THEN** the graph builds and queries run exactly as without the feature and no diagnostics are raised

### Requirement: Property declarations
The system SHALL read for each type its properties, each with a name, a kind (text, number, boolean, date, datetime, link or list), an optional default value, a required flag, a `many` flag (default false) marking a list value, an optional `values` list of allowed values, and an optional `uri`. A property MAY be written as a kind shorthand (`born: date`), a mapping, or an entry in a list.

#### Scenario: Declared property with default
- **WHEN** `Types/Person.md` declares property `status` of kind text with default `active`
- **THEN** the schema for `Person` lists `status` with default `active`, required false and many false

#### Scenario: Enum and list attributes read
- **WHEN** a property declares `{kind: text, values: [active, alumni], many: true}`
- **THEN** the schema lists that property with those allowed values and many true

#### Scenario: Unknown kind
- **WHEN** a property declares a kind that is not supported
- **THEN** the property is treated as text and a diagnostic names the schema note and the property

### Requirement: Allowed edge types
The system SHALL read an optional `edges` declaration per type, either as a list of edge type names or as a mapping from edge type name to a target type name or to `{target, many, required}`, and SHALL report an edge whose source node has that type and whose edge type is not declared. Edge entries SHALL default to many true and required false; a list entry or an entry without a target accepts any target.

#### Scenario: Disallowed edge type reported
- **WHEN** `Person` allows only `knows` and `worksAt` and a Person note contains `owns:: [[Car]]`
- **THEN** a diagnostic points at that edge stating `owns` is not allowed for `Person`

#### Scenario: Map form with target
- **WHEN** `Person` declares `edges: {worksAt: Company}`
- **THEN** `worksAt` is allowed for `Person` with target type `Company`

#### Scenario: No list means unrestricted
- **WHEN** a schema declares no `edges`
- **THEN** every edge type is accepted for that type

### Requirement: Required property validation
The system SHALL report a diagnostic for a note whose type declares a property as required and whose frontmatter lacks it, and SHALL NOT exclude the note from the graph.

#### Scenario: Missing required property
- **WHEN** `Person` requires `born` and a Person note has no `born`
- **THEN** a diagnostic names the note and `born`, and the note is still a node in the graph

### Requirement: Create a note from a type
The system SHALL provide a command that asks for a type and a title and creates a note whose frontmatter contains `type` and every declared default, followed by the type's template. The template SHALL be the note named by the type's `template` link when present, otherwise the body of a `schema:` note, otherwise a template generated from the schema.

#### Scenario: Template applied
- **WHEN** the user creates a note titled `Alice` from the type `Person` whose schema defaults `status` to `active` and whose template body has a `## Notes` heading
- **THEN** the new note has `type: Person`, `status: active` and a `## Notes` heading

#### Scenario: Template note used
- **WHEN** `Person` declares `template: "[[Templates/Person]]"` and that note exists
- **THEN** the new note's body is the body of `Templates/Person`

#### Scenario: Template generated from schema
- **WHEN** `Company` is declared under `schemas:` with properties `name` and `founded`, edge `employs: Person`, and no template link
- **THEN** the new note's frontmatter has `type: Company` and keys `name` and `founded` (empty unless defaulted), and its body has one placeholder line for `employs` that does not produce an edge until a target is filled in

#### Scenario: Existing note is never overwritten
- **WHEN** a note with the requested title already exists
- **THEN** the command reports the conflict and leaves the existing note unchanged

### Requirement: Schema changes take effect live
The system SHALL re-read a schema when its note changes, and SHALL update diagnostics for affected notes without a restart.

#### Scenario: Required flag added
- **WHEN** the user marks `born` as required in `Types/Person.md`
- **THEN** Person notes without `born` gain a diagnostic shortly after the edit

### Requirement: Duplicate type declarations
The system SHALL report a diagnostic naming both notes when the same type or edge type is declared in more than one place, and SHALL use the declaration from the note whose path sorts first.

#### Scenario: Type declared twice
- **WHEN** `Types/A.md` and `Types/B.md` both declare `Person` under `schemas:`
- **THEN** the schema from `Types/A.md` is used and a diagnostic names both notes

### Requirement: Edge type declarations
The system SHALL read edge types declared under `edgeTypes:` as a mapping from edge type name to `{from, to, properties, uri, visualization}`, where `from` and `to` are a type name or list of type names and `properties` uses the same declaration rules as node properties.

#### Scenario: Edge type with properties
- **WHEN** a schema note declares `edgeTypes: {worksAt: {from: Person, to: Company, properties: {since: date, role: {kind: text, required: true}}}}`
- **THEN** the edge type `worksAt` is available with those endpoints and properties

### Requirement: Edge property validation
The system SHALL report, at the edge's line, a declared required edge property missing from the edge's property block and a property value outside its declared `values`; undeclared edge properties SHALL be accepted.

#### Scenario: Missing required edge property
- **WHEN** `worksAt` requires `role` and a note contains `worksAt:: [[Acme]] {since: 2020}`
- **THEN** a diagnostic at that line names `role` and the edge stays in the graph

#### Scenario: Extra edge property accepted
- **WHEN** a `worksAt` edge carries an undeclared property `note`
- **THEN** no diagnostic is raised for it

### Requirement: Edge endpoint validation
The system SHALL report an edge whose typed target note has none of the target types declared for it (by the source type's `edges` entry, else by the edge type's `to`), and an edge whose source has none of the edge type's `from` types. Stub targets and untyped notes SHALL NOT be reported.

#### Scenario: Wrong target type
- **WHEN** `Person` declares `worksAt: Company` and a Person note has `worksAt:: [[Bob]]` where `Bob` has `type: Person`
- **THEN** a diagnostic at that line states `worksAt` expects `Company`

#### Scenario: Stub target not reported
- **WHEN** the target of a `worksAt` edge does not exist as a note
- **THEN** no endpoint diagnostic is raised

### Requirement: Value and cardinality validation
The system SHALL report a property value outside its declared `values`, a list value for a property that is not `many`, and a node lacking an outgoing edge whose entry is `required`, or having more than one where the entry is not `many`.

#### Scenario: Value outside enum
- **WHEN** `status` allows `active` and `alumni` and a note has `status: retired`
- **THEN** a diagnostic names the note, `status` and the allowed values

#### Scenario: Required edge missing
- **WHEN** `Person` declares `worksAt: {target: Company, required: true}` and a Person note has no `worksAt` edge
- **THEN** a diagnostic names the note and `worksAt`

### Requirement: Identifiers
The system SHALL accept an optional `uri` on types, properties and edge types as a full IRI or a CURIE, SHALL know the prefixes `rdf`, `rdfs`, `xsd`, `sh`, `schema`, `foaf` and `tgs`, SHALL read additional prefixes from a top-level `prefixes:` mapping in any schema note, and SHALL report a CURIE whose prefix is unknown.

#### Scenario: CURIE expanded
- **WHEN** `Company` declares `uri: schema:Organization`
- **THEN** its identifier is `https://schema.org/Organization`

#### Scenario: Unknown prefix
- **WHEN** a type declares `uri: ex:Thing` and no schema note defines prefix `ex`
- **THEN** a diagnostic names the type and the prefix
