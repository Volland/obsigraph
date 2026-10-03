# schema-notes Specification

## Purpose
Defines optional schema notes that declare a type's properties, defaults, allowed edge types and template, and the command that creates a note from a type, so vault structure can be typed without making the graph depend on it.

## Requirements

### Requirement: Schema notes are discovered by location
The system SHALL treat each markdown note in the configured schema folder (default `Types/`) as the schema for the type named by the note's title, and SHALL work normally when no schema notes exist.

#### Scenario: Schema found for a type
- **WHEN** the note `Types/Person.md` exists and a note has `type: Person`
- **THEN** the schema for `Person` is available for that note

#### Scenario: No schemas present
- **WHEN** the schema folder is missing or empty
- **THEN** the graph builds and queries run exactly as without the feature and no diagnostics are raised

### Requirement: Property declarations
The system SHALL read from a schema note the list of properties for its type, each with a name, a kind (text, number, boolean, date or link), an optional default value and a required flag.

#### Scenario: Declared property with default
- **WHEN** `Types/Person.md` declares property `status` of kind text with default `active`
- **THEN** the schema for `Person` lists `status` with default `active` and required false

#### Scenario: Unknown kind
- **WHEN** a property declares a kind that is not supported
- **THEN** the property is treated as text and a diagnostic names the schema note and the property

### Requirement: Allowed edge types
The system SHALL read an optional list of allowed edge types per schema, and SHALL report an edge whose source node has that type and whose edge type is not in the list.

#### Scenario: Disallowed edge type reported
- **WHEN** `Person` allows only `knows` and `worksAt` and a Person note contains `owns:: [[Car]]`
- **THEN** a diagnostic points at that edge stating `owns` is not allowed for `Person`

#### Scenario: No list means unrestricted
- **WHEN** a schema declares no allowed edge types
- **THEN** every edge type is accepted for that type

### Requirement: Required property validation
The system SHALL report a diagnostic for a note whose type declares a property as required and whose frontmatter lacks it, and SHALL NOT exclude the note from the graph.

#### Scenario: Missing required property
- **WHEN** `Person` requires `born` and a Person note has no `born`
- **THEN** a diagnostic names the note and `born`, and the note is still a node in the graph

### Requirement: Create a note from a type
The system SHALL provide a command that asks for a type and a title and creates a note whose frontmatter contains `type`, every declared default and the schema's template body.

#### Scenario: Template applied
- **WHEN** the user creates a note titled `Alice` from the type `Person` whose schema defaults `status` to `active` and whose template body has a `## Notes` heading
- **THEN** the new note has `type: Person`, `status: active` and a `## Notes` heading

#### Scenario: Existing note is never overwritten
- **WHEN** a note with the requested title already exists
- **THEN** the command reports the conflict and leaves the existing note unchanged

### Requirement: Schema changes take effect live
The system SHALL re-read a schema when its note changes, and SHALL update diagnostics for affected notes without a restart.

#### Scenario: Required flag added
- **WHEN** the user marks `born` as required in `Types/Person.md`
- **THEN** Person notes without `born` gain a diagnostic shortly after the edit
