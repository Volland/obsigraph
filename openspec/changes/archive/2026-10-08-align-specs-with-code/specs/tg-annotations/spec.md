## MODIFIED Requirements

### Requirement: Annotation validation
The system SHALL report annotations whose target does not resolve, including `openspec:` targets resolved against the OpenSpec index. Schema checks of annotation edge types are not part of `tg check`; `schemaIssues` stays a core helper for hosts that want advisory diagnostics.

#### Scenario: Broken target
- **WHEN** an annotation targets a section that was renamed
- **THEN** `tg check` reports it with file and line

#### Scenario: Broken requirement target
- **WHEN** an annotation targets `openspec:tg-check#Chek`
- **THEN** `tg check` reports it with file, line and the suggestion `openspec:tg-check#Check`

#### Scenario: Edge type outside the schema
- **WHEN** an annotation uses an edge type that a `CodeSymbol` schema note does not list
- **THEN** `tg check` does not report it

### Requirement: Edge source
The system SHALL attach an annotation to the first symbol whose declaration starts within three lines after the end of the comment block containing the annotation; when instead a test call (`it`, `test` or `describe`, optionally with `.each`, `.skip` or `.only`) starts within those lines, it SHALL attach to the file without a warning and record the call's first string argument as the edge property `test`; otherwise, and always in files whose language has no symbol finder, it SHALL attach to the file. A `@tg:` annotation that falls back to the file SHALL record a warning, shown by `tg check --verbose` and in the `warnings` of `tg check --json`; a `@lat:` annotation SHALL fall back silently, as in lat.md.

#### Scenario: Next declaration
- **WHEN** an annotation is directly above `function login()`
- **THEN** the edge source is the symbol `login`

#### Scenario: Test call
- **WHEN** `// @tg: verifies:: [[openspec:auth#Login#Expired token]]` is directly above `it('rejects expired tokens', ...)`
- **THEN** the edge source is the file, the edge has `test` "rejects expired tokens" and no warning is reported

#### Scenario: File fallback
- **WHEN** no declaration or test call follows within three lines
- **THEN** the edge source is the file and a warning is reported

#### Scenario: Window counted from the comment block end
- **WHEN** a `@tg:` line is the first of a five-line comment block and `function login()` starts two lines after the block ends
- **THEN** the edge source is the symbol `login`

#### Scenario: lat annotation falls back silently
- **WHEN** a `// @lat: [[tests#Login]]` comment is followed by no declaration within three lines
- **THEN** the edge source is the file and no warning is recorded

## ADDED Requirements

### Requirement: Source targets verified
`tg check` SHALL report a `@tg:` edge whose target is a source link (`[[src/x.ts#fn]]`) when the file does not exist or the symbol provider reports the symbol absent, and SHALL NOT report a symbol the provider cannot judge.

#### Scenario: Missing symbol
- **WHEN** a comment says `// @tg: calls:: [[src/auth.ts#removed]]` and `src/auth.ts` declares no `removed`
- **THEN** `tg check` reports the edge with file and line and exits 1

### Requirement: tg annotations count for coverage
A `@tg:` edge to a section SHALL count as a code mention for `require-code-mention`, the same as a `@lat:` annotation.

#### Scenario: Covered by tg only
- **WHEN** a test spec leaf is referenced only by `// @tg: verifies:: [[tests#Login#Expired]]`
- **THEN** `tg check` does not report it as uncovered
