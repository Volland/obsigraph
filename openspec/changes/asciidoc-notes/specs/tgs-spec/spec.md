## ADDED Requirements

### Requirement: AsciiDoc notes in TGS 0.3
TGS 0.3 SHALL define a note as a Markdown or AsciiDoc file and SHALL document the AsciiDoc forms: the leading `////` property block, `:tg-*:` attributes and their precedence, `@tg` comment edges and their section anchoring, and cross-format link resolution. It SHALL be published at a versioned URL alongside earlier versions, and schema notes SHALL remain Markdown.

#### Scenario: Published 0.3
- **WHEN** the website is published
- **THEN** the TGS 0.3 specification is reachable at a URL containing `spec/tgs/v0.3/` and earlier versions remain reachable unchanged

#### Scenario: AsciiDoc example
- **WHEN** a reader follows the AsciiDoc example in the specification
- **THEN** it shows a chapter with properties and comment edges and the graph those produce
