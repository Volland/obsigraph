## Why

Edge properties live in a property block on one line, but prose elsewhere cannot cite them. Embeds let a note show `since` for a specific edge inline, and pinned IDs keep such references stable. See lat.md/edge-syntax (Property embeds, Edge identity).

## What Changes

- `{{edge: Alice -knows-> Bob . since}}` resolves by endpoints and type and renders one property value.
- `{{edge: met-2020 . since}}` resolves by pinned ID.
- Without a trailing `. property`, the embed renders the whole property block as a small table.
- Pinned-ID warnings: an edge referenced by an embed through derived identity (endpoints and type) but with no pinned `id` gets a warning suggesting a pin.
- Assumptions: embeds render in reading view and live preview through a markdown post-processor; an endpoint-form embed matching several edges renders the first by derived ordinal and warns about ambiguity; the warning text includes a copy-ready `id` suggestion; the sign prefix in an embed type is optional and, if present, must match.

## Capabilities

### New Capabilities
- `edge-embeds`: Property embeds, edge lookup by endpoints or ID, and pinned-ID warnings.

### Modified Capabilities

## Impact

- Embed post-processor and warnings surface in `packages/plugin`, lookup in `packages/core`.
- Depends on `edge-parsing` and `graph-model` (derived and pinned IDs). Independent of the schema and Cypher changes.
