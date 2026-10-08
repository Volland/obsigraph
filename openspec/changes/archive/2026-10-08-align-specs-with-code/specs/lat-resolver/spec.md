## MODIFIED Requirements

### Requirement: Leading paragraph rule
The system SHALL report, as lat.md does, a section that has no paragraph in its own body before its first child heading (lists, code blocks and quotes are not paragraphs, but a paragraph after them counts), and a section whose first such paragraph is longer than 250 characters after removing `[[wiki link]]` content and markdown formatting.

#### Scenario: Missing leading paragraph
- **WHEN** a heading is immediately followed by a child heading
- **THEN** the section is reported as lacking a leading paragraph

#### Scenario: Wiki links not counted
- **WHEN** a leading paragraph is 240 characters of text plus a 100-character link
- **THEN** it is within the limit

#### Scenario: Paragraph after a code block
- **WHEN** a heading is followed by a code block and then a paragraph, before any child heading
- **THEN** the section is not reported

#### Scenario: Only a list
- **WHEN** a section's own body is a list with no paragraph
- **THEN** the section is reported as lacking a leading paragraph

#### Scenario: Overlong paragraph
- **WHEN** a heading is followed by a 260-character paragraph with no links
- **THEN** the section is reported as too long, with its length

## ADDED Requirements

### Requirement: Fuzzy locate
The system SHALL locate sections for `locate`, `section`, `refs` and `expand` by trying, in order, an exact id, a file stem, trailing heading segments, a heading subsequence and then edit distance up to 40% of the query length, and SHALL report the reason for each match.

#### Scenario: Section name match
- **WHEN** `tg locate "Source of truth"` runs and `lat.md/architecture.md` has that heading
- **THEN** it returns that section with the reason `section name match`

### Requirement: File type labels
The system SHALL read a lat.md file's frontmatter `type:` (a scalar, an inline list or a block list) as extra labels for every section below the file's top-level heading.

#### Scenario: Requirement sections
- **WHEN** `lat.md/reqs.md` has frontmatter `type: Requirement`
- **THEN** `MATCH (s:Requirement) RETURN s.id` returns its sections below the title
