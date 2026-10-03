---
lat:
  require-code-mention: true
---
# Edge Embeds Tests

Test specifications for `{{edge: ...}}` property embeds described in [[edge-syntax#Property embeds]], covering every scenario in the edge-embeds spec.

## Value by endpoints

`{{edge: Alice -knows-> Bob . since}}` renders the property value, with or without `[[ ]]` around endpoints.

## Signed type

A negative edge resolves with an explicit `--type->` sign or with the unsigned `-type->` form.

## Sign mismatch unresolved

An explicit sign that differs from the edge's sign leaves the embed unresolved; `-+type->` requires a positive edge.

## Value by pinned id

`{{edge: met-2020 . since}}` resolves by pinned id, and an unknown id is named in the unresolved marker.

## Whole block as table

Without a property the embed shows every property as table rows, or an empty-state note for an edge with no properties.

## Missing property or edge

A missing property, unknown edge or malformed embed renders an unresolved marker instead of throwing.

## Ambiguous endpoints

Duplicate matching edges render the lowest-ordinal edge and raise an ambiguity warning.

## Pinned id warnings

Only edges referenced by endpoint embeds and lacking an `id` warn, with a copy-ready id suggestion; pinned or unreferenced edges never warn.

## Live value refresh

After the edge's note changes, the embed resolves to the new value.

## Embeds outside code only

Embeds inside fenced or inline code are ignored, and malformed embeds are reported as warnings.
