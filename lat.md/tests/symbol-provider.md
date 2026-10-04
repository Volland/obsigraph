---
lat:
  require-code-mention: true
---
# Symbol Provider Tests

Test specifications for the regex symbol finders and gitignore handling in `packages/core/src/code`, one section per scenario of the symbol-provider spec. See [[cli#Own implementation]].

## Symbol discovery

What the built-in finders extract from a file.

### Class method

A TypeScript class yields the class and each method as `Class#method` with line ranges, alongside top-level functions, constants, types and interfaces, and braces inside strings, comments and regex literals do not confuse nesting.

### Python function

Python top-level `def`, `class` and class methods are found, while a `def` inside a docstring or a nested function is not a symbol.

### Node ES-module sources

Files ending `.mts` and `.cts` are TypeScript and `.mjs` and `.cjs` are JavaScript, even though lat.md rejects them.

## Honest lookup

Three distinct answers for a symbol lookup.

### Absent symbol

A symbol missing from a cleanly scanned file is `absent`, while a file whose strings or braces do not balance answers `unresolvable` instead, so a guess is never an error.

### Unsupported language

A file with no finder or no readable content is `unresolvable`, never `absent`.

## Source walker

Which files are enumerated.

### Ignored folder

Gitignore patterns (negation, anchoring, directory-only, `**`) decide what is skipped, evaluated by a pure matcher shared by the walker.

## Replaceable provider

A provider registered for a language replaces the built-in finder for it, which is the extension point for a tree-sitter backed provider later.

### Registered provider

After registering a provider for `typescript`, lookups use its symbols and ignore the built-in scan.
