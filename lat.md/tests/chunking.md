---
lat:
  require-code-mention: true
---
# Chunking Tests

Test specifications for note chunking and edge verbalization described in [[vector-search#Node chunks]] and [[vector-search#Edge verbalization]].

## One chunk per short section

A note with two short sections yields two chunks, one per heading.

## Oversized section split on boundaries

A section longer than the limit splits into chunks within the limit without breaking words, and their bodies rejoin to the original text.

## Context prefixed to every chunk

Every chunk's embedded text starts with the title, type labels and frontmatter; a plain note gets its title only.

## Chunk provenance recorded

Chunks record the note path and nearest heading (with the heading path); text before any heading has no heading.

## Stable chunk ids

Chunking the same note twice gives identical chunks, and editing one paragraph changes only that chunk's id.

## Node score best or pooled

A node scores as its best chunk by default, or as the similarity of the pooled chunk vector.

## Cosine refuses mixed dimensions

Comparing vectors of different length throws a `RangeError` naming both dimensions instead of returning a NaN score.

## Edge sentence with properties

An edge reads as `Source (Type) verb Target (Type) - props`, with `label` shown bare and the pinned id omitted.

## Edge sentence without properties

Edge type names become verbs (`works_at` → `works at`) and the sentence ends after the target.

## Untyped endpoint has no parentheses

An endpoint without a type is named without parentheses.

## Negative edges say so

A negative edge's verb is followed by `(negative)`.

## Edge sentence provenance

Edge sentences carry the edge id, the source note path and the heading the edge line sits under.
