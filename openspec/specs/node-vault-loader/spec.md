# node-vault-loader Specification

## Purpose
Provides one shared, host-independent way to list and read markdown files from a directory into note inputs for the graph, so the sidecar and the VS Code extension never carry separate copies of file-reading code.

## Requirements

### Requirement: List markdown files
The loader SHALL list markdown files under a directory with `/`-separated relative paths, sorted, skipping any dot-prefixed folder and any folder named in a caller-supplied ignore list.

#### Scenario: Dot folders skipped
- **WHEN** a directory contains `.obsidian/x.md`, `.trash/y.md` and `a.md`
- **THEN** only `a.md` is listed

#### Scenario: Ignore list honored
- **WHEN** the ignore list contains `node_modules` and a nested `node_modules/pkg/README.md` exists
- **THEN** that file is not listed

### Requirement: Read a note read-only
The loader SHALL read a note without modifying it and return its text, parsed YAML frontmatter, a content hash and any frontmatter error message.

#### Scenario: Valid frontmatter
- **WHEN** a note starts with a YAML block `type: Person`
- **THEN** the result carries `frontmatter.type` equal to `Person` and no error

#### Scenario: Broken frontmatter
- **WHEN** a note's YAML block is invalid
- **THEN** the result has null frontmatter and a one-line error, and the note text is still returned

### Requirement: No host dependencies
The loader SHALL depend only on Node built-ins, `@obsigraph/core` and the YAML parser, and SHALL NOT import Obsidian, VS Code or any file watcher.

#### Scenario: Import check
- **WHEN** the package's sources are scanned for imports
- **THEN** no `obsidian` or `vscode` import is found

### Requirement: Sidecar behavior preserved
The sidecar SHALL obtain its file listing and note reading from this package and its observable behavior, including read-only operation, SHALL remain unchanged.

#### Scenario: Sidecar tests unchanged
- **WHEN** the existing sidecar service tests run against the shared loader
- **THEN** they pass without modification
