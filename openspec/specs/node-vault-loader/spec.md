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
The sidecar SHALL obtain its file listing and note reading from this package, and the package SHALL only read: listing and reading a vault SHALL NOT create, modify or delete any file in it.

#### Scenario: Sidecar tests unchanged
- **WHEN** the sidecar service tests run against the shared loader
- **THEN** they pass and every vault file has the same content hash before and after the run

### Requirement: List files by predicate
The package SHALL list arbitrary files under a root by a caller-supplied file-name predicate, skipping dot entries and ignored folder names as markdown listing does, and SHALL skip files larger than an optional byte limit.

#### Scenario: Source files with a size cap
- **WHEN** a caller lists files accepting names ending in `.ts` with a 1 MB limit and the root holds `a.ts` (2 KB) and `big.ts` (3 MB)
- **THEN** only `a.ts` is listed

### Requirement: Path predicate for watchers
The package SHALL expose a predicate that tells whether a path is a note under the same rules listing uses, so file watchers filter changes identically.

#### Scenario: Dot folder ignored by watcher
- **WHEN** a watcher reports a change to `.obsidian/workspace.md`
- **THEN** the predicate says it is not a note
