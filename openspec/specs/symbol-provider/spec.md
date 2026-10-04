# symbol-provider Specification

## Purpose
Defines how code symbols are discovered so links and the code layer can target them without heavy parsers.

## Requirements

### Requirement: Symbol discovery
The system SHALL return, for a source file, its declared symbols with kind, name path and line range for TypeScript, JavaScript, Python, Go, Rust and C.

#### Scenario: Class method
- **WHEN** a TypeScript file declares `class App { listen() {} }`
- **THEN** symbols `App` and `App#listen` are returned with their line ranges

#### Scenario: Python function
- **WHEN** a Python file defines `def parse_args():` at top level
- **THEN** symbol `parse_args` of kind function is returned

#### Scenario: Node ES-module sources
- **WHEN** a file has the extension `.mts`
- **THEN** it is treated as TypeScript

### Requirement: Honest lookup
The system SHALL distinguish a symbol that is found, a symbol absent from a successfully scanned file, and a file that cannot be scanned.

#### Scenario: Absent symbol
- **WHEN** a supported file is scanned and has no symbol `gone`
- **THEN** lookup of `gone` reports `absent`

#### Scenario: Unsupported language
- **WHEN** the file extension has no finder
- **THEN** lookup reports `unresolvable`, not `absent`

### Requirement: Source walker
The system SHALL enumerate source files under the project root, skipping version-control folders, dependency folders, the cache folder and paths ignored by `.gitignore`.

#### Scenario: Ignored folder
- **WHEN** `node_modules/` exists and is listed in `.gitignore`
- **THEN** none of its files are enumerated

### Requirement: Replaceable provider
The system SHALL allow another provider implementing the same interface to be registered in place of the built-in one.

#### Scenario: Registered provider
- **WHEN** a provider is registered for `typescript`
- **THEN** lookups for TypeScript files use it instead of the built-in finder
