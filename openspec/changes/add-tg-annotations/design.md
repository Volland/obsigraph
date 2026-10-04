## Context

The repo's edge grammar is `type:: [[Target]] {props}` with a `-` sign prefix. Inventing a second grammar for code would double parsing, docs and tests.

## Goals / Non-Goals

**Goals:** `@lat:` fully compatible; `@tg:` expressive without a new grammar; every code edge usable in Cypher.

**Non-Goals:** arrow syntax, multi-line annotation blocks, annotations in non-comment positions.

## Decisions

**Reuse `parseEdges`** on the comment payload. Alternative, a dedicated arrow grammar, was rejected for duplicated maintenance; it can be sugar later.

**`@lat:` equals `@tg: references::`.** Both end as the same edge type, so queries do not care which was written.

**Source attachment:** the next declaration within three lines from the symbol provider; otherwise the file node plus a warning. Never attach to a guessed symbol.

**Validation is advisory by default**, using the existing schema notes; edge types not allowed by the schema warn like they do for notes.

## Risks / Trade-offs

- [Comment styles in odd languages] -> per-language comment tables with fixtures.
- [Annotation drift after refactors] -> `tg check` reports edges whose target no longer resolves, same as links.
