## Why

Code links (`[[src/foo.ts#fn]]`) and the code layer need to know which symbols exist in which file. lat.md uses tree-sitter WASM (about 24 MB of grammars); that is too heavy for hooks and impossible in the Obsidian plugin.

## What Changes

- A `SymbolProvider` interface in `core`: given a file's text and language, return symbols with kind, name path (`Class#method`) and line range.
- A built-in regex provider for TypeScript/JavaScript (including `.mts`/`.cts`), Python, Go, Rust and C, plus a source walker honoring `.gitignore`.
- Provider registration so an optional `@typedgraph/symbols-wasm` package can later replace it without API changes.
- Decision: regex first, tree-sitter later and optional.
- Assumption: name-path notation matches lat.md's (`Class#method`, `Struct#Method`).

## Capabilities

### New Capabilities
- `symbol-provider`: Symbol discovery per file and the walker that feeds it.

### Modified Capabilities

## Impact

- New `packages/core/src/code/`; no new runtime dependencies. Used by check, annotations, the code layer and the plugin.
