## MODIFIED Requirements

### Requirement: List markdown files
The loader SHALL list note files (`.md`, and `.adoc` unless the caller turns AsciiDoc off) under a directory with `/`-separated relative paths, sorted, skipping any dot-prefixed folder and any folder named in a caller-supplied ignore list.

#### Scenario: Dot folders skipped
- **WHEN** a directory contains `.obsidian/x.md`, `.trash/y.md` and `a.md`
- **THEN** only `a.md` is listed

#### Scenario: Ignore list honored
- **WHEN** the ignore list contains `node_modules` and a nested `node_modules/pkg/README.md` exists
- **THEN** that file is not listed

#### Scenario: AsciiDoc listed
- **WHEN** a directory contains `a.md` and `book/ch01.adoc`
- **THEN** both are listed, and only `a.md` when AsciiDoc is turned off

### Requirement: Read a note read-only
The loader SHALL read a note without modifying it and return its text, parsed YAML frontmatter, a content hash and any frontmatter error message. For an `.adoc` note the frontmatter SHALL be the merged properties of its leading comment block and `:tg-*:` attributes.

#### Scenario: Valid frontmatter
- **WHEN** a note starts with a YAML block `type: Person`
- **THEN** the result carries `frontmatter.type` equal to `Person` and no error

#### Scenario: Broken frontmatter
- **WHEN** a note's YAML block is invalid
- **THEN** the result has null frontmatter and a one-line error, and the note text is still returned

#### Scenario: AsciiDoc metadata
- **WHEN** an `.adoc` note has a leading `////` block with `type: Chapter` and a `:tg-status: draft` attribute
- **THEN** the result carries `frontmatter.type` `Chapter` and `frontmatter.status` `draft`
