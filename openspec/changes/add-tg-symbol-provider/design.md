## Context

Hooks run `tg` on every prompt, and the plugin cannot load WASM grammars cheaply. A regex declaration finder is fast and tiny, with known accuracy limits.

## Goals / Non-Goals

**Goals:** fast, dependency-free symbol lookup for five language families; honest about uncertainty; replaceable.

**Non-Goals:** type information, cross-file resolution, accurate handling of macros or generated code.

## Decisions

**Interface first.** `SymbolProvider.symbols(text, lang)` is the only contract, so tree-sitter slots in later.

**Three outcomes for a lookup:** found, absent in a parsed file, or `unresolvable` (language unsupported or file unreadable). Only the middle outcome is an error in `check`.

**Brace and indentation tracking** gives nesting for classes and methods without a full grammar.

**Walker ignores** `.git`, `node_modules`, `.tg` and anything in `.gitignore`.

## Risks / Trade-offs

- [Misses unusual syntax] -> per-language fixture suites; a miss yields `unresolvable`, not a false error, when a file contains constructs the scanner flags as uncertain.
- [Name-path drift from lat.md] -> covered by the parity suite on code refs.
