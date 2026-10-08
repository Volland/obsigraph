## MODIFIED Requirements

### Requirement: Source walker
The system SHALL enumerate files under the project root, always skipping `.git/`, `node_modules/` and every dot entry at the top level (which includes the `.tg/` cache), and skipping paths matched by any `.gitignore` in the root or a subdirectory, with standard precedence and negation.

#### Scenario: Ignored folder
- **WHEN** `node_modules/` exists and is listed in `.gitignore`
- **THEN** none of its files are enumerated

#### Scenario: Nested gitignore
- **WHEN** `src/.gitignore` lists `secret.ts`
- **THEN** neither `src/secret.ts` nor `src/keep/secret.ts` is enumerated, while `src/a.ts` is

## ADDED Requirements

### Requirement: Comments and strings masked
The built-in symbol finders SHALL blank comments and string literals before scanning, so braces or keywords inside them do not change nesting or create symbols.

#### Scenario: Brace in a string
- **WHEN** a class body contains a string literal `"}"` before its method `save()`
- **THEN** `save` is still found as a member of that class
