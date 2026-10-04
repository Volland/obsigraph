---
lat:
  require-code-mention: true
---
# TG Annotation Tests

Test specifications for the `@lat:` and `@tg:` comment annotations scanned by `packages/core/src/code/annotations.ts`, one section per scenario of the tg-annotations spec. See [[cli#Annotations]].

## lat annotations

The lat.md-compatible plain link.

### Test reference

A line comment `@lat: [[section]]` above a function becomes a `references` edge from that function to the section.

### Python comment

A hash comment is read the same way and attaches to the following `def`.

## tg annotations

The typed form.

### Typed edge with properties

`@tg: implements:: [[auth#Login]] {since: 2}` yields an `implements` edge with the property parsed by the shared edge parser.

### Negative edge

A leading `-` on the type makes the edge's sign -1.

### Several edges

Comma-separated segments each become an edge without splitting property blocks, block comments are accepted, and a bare link is a `references` edge.

## Edge source

What an annotation is attached to.

### Next declaration

The annotation attaches to the declaration starting within three lines after its comment run, including a class member, which is addressed as `Class#member`.

### File fallback

With no declaration in reach the edge belongs to the file and a warning says so.

## Annotation validation

Checking what annotations point at.

### Broken target

A target whose section no longer exists is reported with the closest suggestion, source links are handed to the caller for symbol checks, and edge types a schema forbids are advisory issues.
