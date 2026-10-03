## Context

Greenfield repo. `core` must stay free of Obsidian and DOM APIs so the later sidecar can import it. Motivation is in proposal.md; agreed decisions are in lat.md.

## Goals / Non-Goals

**Goals:** a pure, well-tested parser and a monorepo skeleton.

**Non-Goals:** graph building, Cypher, any UI.

## Decisions

**npm workspaces with `packages/core` and `packages/plugin`.** Alternative, one package with folders, was rejected because the boundary would erode and the sidecar needs a clean import. A test in `core` asserts no forbidden imports.

**Hand-written line scanner plus a tolerant property-block parser.** The scanner tracks fenced code and headings and matches the edge form; the block parser accepts unquoted keys, numbers, booleans, quoted strings and an optional trailing comma. Regex-only was rejected (nested braces and quotes), a parser generator was rejected as heavy for one line form. A malformed block yields an edge without properties plus a diagnostic.

**Vitest for tests, tsc for type checking.** Fast, zero-config TypeScript.

## Risks / Trade-offs

- [Graph Link Types syntax variants not yet enumerated] -> parser covers the documented inline-field form; extend when more forms are found.
- [Sign semantics may change] -> isolated in one parser step.
