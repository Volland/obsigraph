## ADDED Requirements

### Requirement: Property value types
The system SHALL read edge property values as JSON5-like literals: bare numbers as numbers, `true` and `false` as booleans, `null` as null, `[...]` as lists, quoted strings with escapes as strings and unquoted words as strings, allowing a trailing comma.

#### Scenario: Typed values
- **WHEN** an edge line ends with `{since: 2020, active: true, tags: [a, "b c"], note: null,}`
- **THEN** the edge has `since` 2020 as a number, `active` true as a boolean, `tags` as the list `a`, `b c`, and `note` null

### Requirement: Edge lines in lists and quotes
The system SHALL recognize an edge line whose type is preceded by a list-item marker or a blockquote prefix, and SHALL produce no edge and no diagnostic for a `type::` line that contains no link.

#### Scenario: Edge in a list item
- **WHEN** a note contains `- knows:: [[Bob]]`
- **THEN** the note has a `knows` edge to `Bob`

#### Scenario: Placeholder without a link
- **WHEN** a note contains `employs:: ` with nothing after it
- **THEN** no edge and no diagnostic is produced for that line
