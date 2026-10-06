## ADDED Requirements

### Requirement: Markdown link targets
The system SHALL accept standard markdown links to notes as edge targets in an edge line, alone or mixed with wikilinks, and SHALL normalize their paths to vault paths: percent escapes decoded, `#anchor` kept as the subpath, `./` and `../` resolved against the source note's folder, a leading `/` meaning the vault root. Links with a URL scheme SHALL NOT produce edges.

#### Scenario: Bundle-absolute link
- **WHEN** `people/alice.md` contains `knows:: [Bob](/people/bob.md) {since: 2020}`
- **THEN** the system produces an edge of type `knows` to `people/bob.md` with `since` = 2020

#### Scenario: Relative link
- **WHEN** `people/alice.md` contains `works_at:: [Acme](../orgs/acme.md)`
- **THEN** the edge target is `orgs/acme.md`

#### Scenario: External URL
- **WHEN** a note contains `cites:: [paper](https://example.com/paper)`
- **THEN** no edge is produced
