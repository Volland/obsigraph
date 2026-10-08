## MODIFIED Requirements

### Requirement: Live refresh
The system SHALL update rendered embeds and warnings when the referenced edge's note or the embedding note changes, in the same vault index update that processes the change, without reopening the note.

#### Scenario: Value edited
- **WHEN** the user changes `since` on the edge from 2020 to 2021
- **THEN** after the index processes that change, open embeds of that value show `2021` without the note being reopened

## ADDED Requirements

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
