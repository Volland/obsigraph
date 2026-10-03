## Why

Typed, signed edges with properties have no home in Obsidian today. Edge parsing is the foundation every later capability reads from, and this change also creates the monorepo they all live in. See lat.md/edge-syntax.

## What Changes

- Create the npm-workspaces monorepo with `packages/core` (no Obsidian or DOM imports) and `packages/plugin`, TypeScript, lint and a test runner.
- Add the edge parser: `[+-]?type:: [[Target]] {props}`, fenced-code skipping, tolerant property blocks, heading metadata, diagnostics.
- Assumption (sign semantics still open): sign is a +1/-1 polarity from the type prefix, default +1; `weight` is an ordinary property.

## Capabilities

### New Capabilities
- `edge-parsing`: Parse typed, signed edges with an optional property block from note bodies, compatible with Graph Link Types.

### Modified Capabilities

## Impact

- New `packages/core` parser module and its tests; new root tooling and a `.gitignore`.
- No runtime behavior in Obsidian yet.
