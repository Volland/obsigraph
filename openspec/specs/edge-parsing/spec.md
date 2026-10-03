# edge-parsing Specification

## Purpose
Defines how typed, signed edges with optional properties are written in note bodies and recognized by the plugin, while staying compatible with Graph Link Types' inline-field syntax.

## Requirements

### Requirement: Inline edge form
The system SHALL recognize a line of the form `type:: [[Target]]` as an edge of the given type from the containing note to the target, and SHALL accept an optional trailing property block `{key: value, ...}`.

#### Scenario: Plain Graph Link Types line
- **WHEN** a note contains `knows:: [[Bob]]`
- **THEN** the system produces one edge of type `knows` to `Bob` with no properties

#### Scenario: Line with properties
- **WHEN** a note contains `knows:: [[Bob]] {since: 2020, label: "met at conf"}`
- **THEN** the edge has properties `since` = 2020 (number) and `label` = "met at conf" (string)

### Requirement: Sign prefix
The system SHALL treat a `+` or `-` prefix on the edge type as the edge's sign, SHALL default the sign to +1 when no prefix is present, and SHALL strip the prefix from the type name.

#### Scenario: Negative edge
- **WHEN** a note contains `-distrusts:: [[Eve]]`
- **THEN** the edge has type `distrusts` and sign -1

#### Scenario: Unsigned edge
- **WHEN** a note contains `knows:: [[Bob]]`
- **THEN** the edge has sign +1

### Requirement: Weight is independent of sign
The system SHALL expose `weight` as an ordinary numeric property and SHALL NOT derive sign from it.

#### Scenario: Negative weight on positive edge
- **WHEN** a note contains `knows:: [[Bob]] {weight: -0.8}`
- **THEN** the edge has sign +1 and property `weight` = -0.8

### Requirement: Source heading is recorded
The system SHALL record the nearest preceding heading of an edge line as edge metadata.

#### Scenario: Edge under a heading
- **WHEN** an edge line appears under the heading `## Colleagues`
- **THEN** the edge records `Colleagues` as its source heading

### Requirement: Malformed property blocks
The system SHALL keep the edge when its property block is malformed, SHALL ignore the unparseable block, and SHALL report a diagnostic naming the note and line.

#### Scenario: Unclosed block
- **WHEN** a note contains `knows:: [[Bob]] {since: 2020`
- **THEN** the edge `knows` to `Bob` exists with no properties and a diagnostic is reported for that line

### Requirement: Non-edge text is ignored
The system SHALL NOT create edges from lines inside fenced code blocks or from lines that do not match the inline edge form.

#### Scenario: Edge syntax in a code fence
- **WHEN** `knows:: [[Bob]]` appears inside a fenced code block
- **THEN** no edge is created
