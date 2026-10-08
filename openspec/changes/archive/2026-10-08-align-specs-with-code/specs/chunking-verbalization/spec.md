## ADDED Requirements

### Requirement: Code fences and frontmatter in chunking
The system SHALL NOT start a new chunk at a `#` line inside a fenced code block (opened by three backticks or three tildes), and SHALL never include the note's YAML frontmatter block in a chunk body.

#### Scenario: Heading-like line in code
- **WHEN** a note section contains a fenced code block with a line `# not a heading`
- **THEN** that line stays in the section's chunk and does not start a new chunk

#### Scenario: Frontmatter excluded
- **WHEN** a note starts with a frontmatter block containing `secret_key: x`
- **THEN** no chunk body contains `secret_key`
