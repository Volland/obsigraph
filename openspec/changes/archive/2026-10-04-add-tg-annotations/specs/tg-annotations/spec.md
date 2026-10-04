## Purpose

Defines the comment annotations that tie source code to documentation and to typed graph edges.

## ADDED Requirements

### Requirement: lat annotations
The system SHALL read `@lat: [[section]]` in a code comment as a `references` edge from the annotated code to that section.

#### Scenario: Test reference
- **WHEN** a test file has `// @lat: [[tests#Login#Rejects expired tokens]]` above a test function
- **THEN** that function has a `references` edge to the section

#### Scenario: Python comment
- **WHEN** a Python file has `# @lat: [[tests#Login]]`
- **THEN** it is read the same way

### Requirement: tg annotations
The system SHALL read `@tg:` followed by the inline edge grammar as typed, signed edges with properties, and a bare link as `references`.

#### Scenario: Typed edge with properties
- **WHEN** a comment is `// @tg: implements:: [[auth#Login]] {since: 2}`
- **THEN** an `implements` edge with `since` 2 goes to that section

#### Scenario: Negative edge
- **WHEN** a comment is `// @tg: -contradicts:: [[design#Cache]]`
- **THEN** the edge `contradicts` has sign -1

#### Scenario: Several edges
- **WHEN** a comment is `// @tg: implements:: [[a#X]], tests:: [[b#Y]]`
- **THEN** both edges are produced

### Requirement: Edge source
The system SHALL attach an annotation to the symbol declared within three lines after it, otherwise to the file, and SHALL warn when it falls back to the file.

#### Scenario: Next declaration
- **WHEN** an annotation is directly above `function login()`
- **THEN** the edge source is the symbol `login`

#### Scenario: File fallback
- **WHEN** no declaration follows within three lines
- **THEN** the edge source is the file and a warning is reported

### Requirement: Annotation validation
The system SHALL report annotations whose target does not resolve, and SHALL report edge types or targets that violate schema notes as advisory diagnostics.

#### Scenario: Broken target
- **WHEN** an annotation targets a section that was renamed
- **THEN** `tg check` reports it with file and line
