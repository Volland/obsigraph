## Why

Code needs a way to point at docs. `@lat:` is the lat.md convention and must keep working. `@tg:` extends it with typed edges so code links become labeled graph edges.

## What Changes

- Scan `//`, `#` and `/* */` comments for `@lat: [[section]]` (plain `references` link) and `@tg: <edges>`.
- `@tg:` accepts the existing inline edge grammar: `implements:: [[auth#Login]] {since: 2}`, `-contradicts:: [[x]]`, comma-separated. A bare `@tg: [[x]]` means `references::`.
- The source of an edge is the symbol declared right after the comment, else the file; the latter raises a warning.
- Optional schema checks: edge type allowed, target section under an expected folder.
- Decision: one grammar for docs, notes and code; arrow syntax is deferred.
- Assumption: a comment annotation applies to the next declaration within three lines.

## Capabilities

### New Capabilities
- `tg-annotations`: Annotation syntax, source attachment and validation.

### Modified Capabilities
- `edge-parsing`: the inline edge parser is reused on comment text with a comment prefix stripped.

## Impact

- New scanner in `packages/core/src/code/`; reuses `parseEdges`. Feeds `tg check`, `tg refs` and the code layer.
- Depends on `add-tg-lat-resolver` and `add-tg-symbol-provider`.
