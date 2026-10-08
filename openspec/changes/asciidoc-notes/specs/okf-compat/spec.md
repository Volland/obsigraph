## ADDED Requirements

### Requirement: AsciiDoc notes skipped in OKF export
The OKF export SHALL leave `.adoc` notes out of the bundle and list each one in the change report as skipped. Links from exported notes to an `.adoc` note SHALL be written as plain text and counted in the report.

#### Scenario: Chapter skipped
- **WHEN** a vault holds `book/ch03.adoc` and `Concepts/Metagraph.md`
- **THEN** the bundle contains only the Markdown note and the report lists `book/ch03.adoc` as skipped

#### Scenario: Link to a chapter
- **WHEN** `Concepts/Metagraph.md` has `appears_in:: [[ch03]]`
- **THEN** the exported note keeps the edge type with the target as plain text, and the report counts it
