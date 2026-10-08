## MODIFIED Requirements

### Requirement: Check
The system SHALL report every broken wiki link, broken code reference (including `openspec:` annotation targets and unknown entries in `openspec:` frontmatter), leading-paragraph violation and uncovered `require-code-mention` section, and SHALL exit 1 when any exist. Missing OpenSpec traceability SHALL NOT be a finding.

#### Scenario: Uncovered test spec
- **WHEN** a file with `require-code-mention: true` has a leaf section no code comment references
- **THEN** `tg check` reports that section and exits 1

#### Scenario: Clean project
- **WHEN** all links resolve and all rules hold
- **THEN** `tg check` prints a success line and exits 0

#### Scenario: Unknown frontmatter capability
- **WHEN** a lat.md file has `openspec: [no-such-cap]`
- **THEN** `tg check` reports the file and the unknown name and exits 1

#### Scenario: Untraced requirement
- **WHEN** a requirement has no `implements` annotation
- **THEN** `tg check` does not report it
