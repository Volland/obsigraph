## MODIFIED Requirements

### Requirement: Sidecar behavior preserved
The sidecar SHALL obtain its file listing and note reading from this package, and the package SHALL only read: listing and reading a vault SHALL NOT create, modify or delete any file in it.

#### Scenario: Sidecar tests unchanged
- **WHEN** the sidecar service tests run against the shared loader
- **THEN** they pass and every vault file has the same content hash before and after the run

## ADDED Requirements

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
