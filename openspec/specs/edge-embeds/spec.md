# edge-embeds Specification

## Purpose
Defines the property embed syntax that shows an edge's property value or whole property table inside prose, how an embed finds its edge, and the warnings for references that are not stable because the edge lacks a pinned ID.

## Requirements

### Requirement: Embed by endpoints
The system SHALL resolve `{{edge: Source -type-> Target . property}}` to the edge of that type from `Source` to `Target` and render the value of `property`.

#### Scenario: Value rendered
- **WHEN** Alice has `knows:: [[Bob]] {since: 2020}` and a note contains `{{edge: Alice -knows-> Bob . since}}`
- **THEN** the embed renders `2020` in place

#### Scenario: Signed type
- **WHEN** the embed uses `--distrusts->` or the unsigned `-distrusts->` and the edge was written as `-distrusts:: [[Eve]]`
- **THEN** the embed resolves that edge

#### Scenario: Sign mismatch
- **WHEN** the embed uses `--knows->` (a `-` sign before the type) and the only matching edge is positive
- **THEN** the embed shows an unresolved marker instead of a value

### Requirement: Embed by pinned ID
The system SHALL resolve `{{edge: id . property}}` to the edge whose pinned `id` property equals `id`.

#### Scenario: Resolve by ID
- **WHEN** an edge is written with `{id: "met-2020", since: 2020}` and a note contains `{{edge: met-2020 . since}}`
- **THEN** the embed renders `2020`

#### Scenario: Unknown ID
- **WHEN** no edge has the pinned ID
- **THEN** the embed shows an unresolved marker naming the ID

### Requirement: Whole property block as table
The system SHALL render the full property block of the edge as a small two-column table of property names and values when the embed has no trailing property.

#### Scenario: Table rendered
- **WHEN** a note contains `{{edge: met-2020}}` and the edge has `since: 2020` and `label: "met at conf"`
- **THEN** a table with rows `since` and `label` and their values is rendered

#### Scenario: Edge without properties
- **WHEN** the resolved edge has no properties
- **THEN** the embed renders an empty-state note instead of an empty table

### Requirement: Missing property and unresolved embeds
The system SHALL render a visible unresolved marker, and not an error that breaks the page, when the edge is not found or the property is absent.

#### Scenario: Property absent
- **WHEN** the edge exists but has no `since`
- **THEN** the embed renders an unresolved marker naming `since`

#### Scenario: Edge not found
- **WHEN** no edge matches the endpoints and type
- **THEN** the embed renders an unresolved marker and the rest of the page renders normally

### Requirement: Ambiguous endpoint embeds
The system SHALL, when several duplicate edges match an endpoint embed, render the one with the lowest ordinal and report an ambiguity warning recommending pinned IDs.

#### Scenario: Duplicate edges
- **WHEN** Alice has two `knows` edges to Bob and the embed uses endpoints
- **THEN** the first edge's value is rendered and a warning states that two edges match

### Requirement: Pinned-ID warnings
The system SHALL warn about each edge that is referenced by an endpoint embed and has no pinned `id`, and SHALL NOT warn about edges referenced only by pinned ID or not referenced at all.

#### Scenario: Warning for unpinned reference
- **WHEN** a note embeds `{{edge: Alice -knows-> Bob . since}}` and the edge has no `id`
- **THEN** a warning names the edge and suggests adding an `id` property

#### Scenario: No warning when pinned
- **WHEN** the referenced edge has a pinned `id`
- **THEN** no pinned-ID warning is raised for it

#### Scenario: Unreferenced unpinned edge
- **WHEN** an edge has no `id` and no embed references it
- **THEN** no warning is raised

### Requirement: Live refresh
The system SHALL update rendered embeds and warnings when the referenced edge's note or the embedding note changes, in the same vault index update that processes the change, without reopening the note.

#### Scenario: Value edited
- **WHEN** the user changes `since` on the edge from 2020 to 2021
- **THEN** after the index processes that change, open embeds of that value show `2021` without the note being reopened

### Requirement: Embeds inside code are ignored
The system SHALL NOT render, resolve or report `{{edge: ...}}` text inside fenced code blocks or inline code.

#### Scenario: Embed in a code fence
- **WHEN** a note shows `{{edge: Alice -knows-> Bob}}` inside a fenced code block
- **THEN** the text renders verbatim and no embed warning is reported for it

### Requirement: Malformed embeds reported
The system SHALL render a malformed embed (bad arrow syntax, an id with spaces, a missing endpoint) as an unresolved marker that states the parse error, and SHALL report it as a diagnostic at its line.

#### Scenario: Missing endpoint
- **WHEN** a note contains `{{edge: Alice -knows->}}`
- **THEN** the embed shows an unresolved marker with the parse error and a diagnostic points at that line
