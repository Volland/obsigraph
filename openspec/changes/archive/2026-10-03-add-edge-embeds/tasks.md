## 1. Embed parsing and lookup

- [x] 1.1 Parse both embed forms with optional trailing `. property` and optional `[[ ]]` around endpoints
- [x] 1.2 Implement the shared edge lookup by pinned ID or by endpoints, type and sign
- [x] 1.3 Handle duplicate matches with lowest-ordinal selection and an ambiguity result

## 2. Rendering

- [x] 2.1 Add the markdown post-processor for reading view and live preview
- [x] 2.2 Render a single value, the whole-block table, the empty-state and unresolved markers
- [x] 2.3 Refresh embeds when the edge's note or the embedding note changes

## 3. Warnings

- [x] 3.1 Raise pinned-ID warnings for edges referenced by endpoint embeds without an `id`, with a suggested id
- [x] 3.2 Raise ambiguity warnings and surface warnings in the plugin diagnostics

## 4. Tests

- [x] 4.1 Write tests covering every scenario in the edge-embeds spec

## 5. Sync

- [x] 5.1 Update lat.md/edge-syntax, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
