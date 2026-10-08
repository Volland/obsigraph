## MODIFIED Requirements

### Requirement: Edge source
The system SHALL attach an annotation to the symbol declared within three lines after it; when instead a test call (`it`, `test` or `describe`, optionally with `.each`, `.skip` or `.only`) starts within those lines, it SHALL attach to the file without a warning and record the call's first string argument as the edge property `test`; otherwise it SHALL attach to the file and warn.

#### Scenario: Next declaration
- **WHEN** an annotation is directly above `function login()`
- **THEN** the edge source is the symbol `login`

#### Scenario: Test call
- **WHEN** `// @tg: verifies:: [[openspec:auth#Login#Expired token]]` is directly above `it('rejects expired tokens', ...)`
- **THEN** the edge source is the file, the edge has `test` "rejects expired tokens" and no warning is reported

#### Scenario: File fallback
- **WHEN** no declaration or test call follows within three lines
- **THEN** the edge source is the file and a warning is reported

### Requirement: Annotation validation
The system SHALL report annotations whose target does not resolve, including `openspec:` targets resolved against the OpenSpec index, and SHALL report edge types or targets that violate schema notes as advisory diagnostics.

#### Scenario: Broken target
- **WHEN** an annotation targets a section that was renamed
- **THEN** `tg check` reports it with file and line

#### Scenario: Broken requirement target
- **WHEN** an annotation targets `openspec:tg-check#Chek`
- **THEN** `tg check` reports it with file, line and the suggestion `openspec:tg-check#Check`
