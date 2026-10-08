# lat-resolver Specification

## Purpose
Defines how a `lat.md/` folder is parsed into sections and how links into it resolve, compatibly with lat.md, so one definition serves the CLI, the plugin and the sidecar.

## Requirements

### Requirement: Section tree
The system SHALL parse a markdown file into nested sections by heading level, ignoring headings inside fenced code and frontmatter, and SHALL record each section's leading paragraph.

#### Scenario: Nested headings
- **WHEN** a file has `# A`, `## B`, `### C`
- **THEN** C is a child of B, which is a child of A

#### Scenario: Heading in code fence
- **WHEN** a fenced block contains a line starting with `## `
- **THEN** it is not a section

### Requirement: Section ids
The system SHALL identify a section by `lat.md/path/file#Heading#Sub` and accept the short form `file#Heading#Sub` when the file name is unique within the folder.

#### Scenario: Short id
- **WHEN** only one file is named `search.md`
- **THEN** `search#Indexing` resolves to the same section as `lat.md/tests/search#Indexing`

#### Scenario: Ambiguous short id
- **WHEN** two files are named `search.md`
- **THEN** the short id resolves to `ambiguous` listing both candidates

### Requirement: Link resolution
The system SHALL resolve `[[target]]` and `[[target|alias]]` outside code to a section, a file, a code target such as `src/foo.ts#fn`, or a failure kind, and SHALL never guess between candidates.

#### Scenario: Code target
- **WHEN** a link is `[[src/config.ts#getConfigDir]]`
- **THEN** it resolves to a `code` result naming the file and symbol path

#### Scenario: Missing section
- **WHEN** a link names a heading that does not exist in an existing file
- **THEN** it resolves to `missing` with the closest section suggested

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
