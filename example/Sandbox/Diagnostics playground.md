# Diagnostics playground

This note contains deliberate mistakes. Run **Typed Graph: Show diagnostics** (or click the status bar item) to see how each one is reported. None of them stops the graph from working.

## Malformed property block

The closing brace is missing. The edge is kept, its properties are dropped, and a diagnostic points at the line:

relates_to:: [[Acme]] {since: 2020

## Embed without a pinned id

This embed finds the edge by its endpoints. It works, but the edge has no `id`, so reordering Carol's lines could change which edge it means. Diagnostics suggest pinning one: {{edge: Carol -contributes-> Ranking . hours}} hours.

## Embed that matches nothing

There is no such edge, so the embed shows a marker instead of an error: {{edge: Bob -hates-> Alice . since}}

## Schema issues elsewhere

- [[Dave]] has no `role`, which the [[Person]] schema requires.
- [[Mallory]] has a `sells_to` edge, which the [[Person]] schema does not allow.

## Broken query

The error shows the line and column of the problem:

```graph-query
MATCH (p:Person
RETURN p
```

Write clauses are rejected because queries are read-only:

```graph-query
MATCH (p:Person) SET p.role = "boss"
```
