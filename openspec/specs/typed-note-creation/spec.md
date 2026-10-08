# typed-note-creation Specification

## Purpose
Creates notes from a declared type with generated identifiers (UUID, time-ordered UUID, timestamp, Luhmann) and filled-in template tokens, the same way in Obsidian and VS Code, as defined by the `id` key of TGS 0.2.

## Requirements

### Requirement: Id rules
A type SHALL declare the ids its new notes get with the `id` key: a bare kind (`uuid`, `uuid7`, `timestamp` or `luhmann`), a mapping with `kind`, `property` (default `id`), `auto` (default true, except false for `luhmann`) and `filename` (default false), or a list of mappings each naming its `property`. A property named by an id rule SHALL be declared as a text property when the type does not declare it. An unknown kind, an unknown key, a list entry without a property and a repeated property SHALL each be reported as a diagnostic and that entry ignored.

#### Scenario: Id key forms
- **WHEN** one type declares `id: uuid7` and another `id: [{kind: uuid7, property: uid}, {kind: luhmann, property: folgezettel}]`
- **THEN** the first has one automatic `uuid7` rule on `id`, and the second an automatic `uuid7` rule on `uid` and a non-automatic `luhmann` rule on `folgezettel`

#### Scenario: Id property is implied
- **WHEN** a type declares `id: {kind: uuid, property: ref}` and no `ref` property
- **THEN** the type has a text property `ref`

#### Scenario: Invalid id declarations
- **WHEN** a type declares `id: [{kind: guid, property: a}, {kind: uuid}]`
- **THEN** two diagnostics are reported, one for the unknown kind and one for the entry without a property, and neither rule is used

### Requirement: Generated ids
The system SHALL generate well-formed ids that are unique among the values the property already has in the vault: `uuid` a version 4 UUID; `uuid7` a version 7 UUID whose first 48 bits carry the millisecond clock, so ids made later sort later as plain strings; `timestamp` `YYYYMMDDHHmm` in local time, moving forward a minute at a time while the id is taken; and `luhmann` Folgezettel ids that alternate numbers and letters.

#### Scenario: UUID versions
- **WHEN** a `uuid` and a `uuid7` id are generated
- **THEN** both have the 8-4-4-4-12 shape with version digits 4 and 7 and the RFC variant

#### Scenario: Time-ordered ids sort
- **WHEN** `uuid7` ids are generated at increasing times
- **THEN** they sort as plain strings in creation order

#### Scenario: Timestamp id skips taken minutes
- **WHEN** a `timestamp` id is generated at 2026-10-08 14:30 local time and `202610081430` is already used
- **THEN** the id is `202610081431`

#### Scenario: Luhmann siblings
- **WHEN** next siblings are generated for `1a`, `1z` and `3`
- **THEN** they are `1b`, `1aa` and `4`, skipping any that are used

#### Scenario: Luhmann children
- **WHEN** a child is generated for `1` and for `1a`
- **THEN** they are `1a` and `1a1`, and when the first child is taken the next sibling of it is used

#### Scenario: Luhmann roots and order
- **WHEN** a new top-level id is generated and the largest top-level number is `9`
- **THEN** the id is `10`, and ids order as `1`, `1a`, `1a1`, `1b`, `2`, `10`

### Requirement: Template tokens
The system SHALL fill the template of a new note with `{{title}}`, `{{date}}`, `{{time}}`, `{{id}}` (the first generated id), `{{<id property>}}` for each generated id and, when the note has a parent, `{{parent}}`, `{{parent-id}}` and `{{parent-link}}`; a template line that mentions a parent token SHALL be dropped when there is no parent, and any other double-brace text, such as an edge embed, SHALL be left unchanged.

#### Scenario: Ids and tokens
- **WHEN** a note `Idea` is created from a type with `id: uuid7` and template `# {{title}}\nid: {{id}}\n{{edge: a -knows-> b}}`
- **THEN** the note shows the title `Idea`, the generated id and the unchanged edge embed, and its frontmatter holds the id

#### Scenario: Lines without a parent are dropped
- **WHEN** a template has the line `Continues: {{parent-link}}` and the note is created without a parent
- **THEN** that line is absent from the new note

### Requirement: File name carries the id
When an id rule sets `filename: true`, the system SHALL prefix the new note's file name with the generated id and a space.

#### Scenario: Prefixed file name
- **WHEN** a note `Idea` is created from a type whose `timestamp` rule has `filename: true` at 2026-10-08 14:30
- **THEN** the file is named `202610081430 Idea.md`

### Requirement: Luhmann placement
The system SHALL create a child or sibling of the active note by reading the active note's Luhmann id from its type's luhmann rule, giving the new note the next free child or sibling id and filling the parent tokens from the active note, and SHALL create a top-level note with the next free top-level number.

#### Scenario: Child of the active note
- **WHEN** the active note has `folgezettel: 1a`, `1a1` exists and the user creates a child note
- **THEN** the new note gets `folgezettel: 1a2` and its template's parent link points to the active note

### Requirement: Note creation commands
The Obsidian plugin SHALL offer "New typed note", a ribbon menu with one entry per type, "New typed note here" on a folder's context menu, and "New child note", "New sibling note" and "New top-level note" for Luhmann types; the VS Code extension SHALL offer "New Typed Note" (also on Explorer folders), "New Child Note" and "New Sibling Note" reading types from `typegraph.schemaFolder`. Both hosts SHALL plan the note with the same core planner, SHALL refuse an unknown type or an invalid title, and SHALL never overwrite an existing file.

#### Scenario: New note in a folder
- **WHEN** the user picks "New typed note here" on folder `Notes/` and type `Permanent` with title `Idea`
- **THEN** a note for `Idea` of type `Permanent` is created in `Notes/` with its generated ids and template

#### Scenario: Existing file kept
- **WHEN** the planned file already exists
- **THEN** the command reports the conflict and the existing file is unchanged

#### Scenario: Unknown type refused
- **WHEN** VS Code is asked to plan a note of a type no schema note declares
- **THEN** nothing is written and the user is told the type is unknown
