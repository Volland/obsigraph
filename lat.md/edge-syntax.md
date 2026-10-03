# Edge Syntax

How authors write typed, signed edges with properties inside markdown, and how edges are identified and embedded elsewhere.

## Inline edge form

An edge is a single line `type:: [[Target]] {props}` where the property block is optional, so plain Graph Link Types lines stay valid unchanged.

Example: `knows:: [[Bob]] {since: 2020, weight: -0.8, label: "met at conf"}`. Source heading is recorded as edge metadata so sub-note nodes can be added later without breaking edges.

## Sign

An edge's sign comes from a `+` or `-` prefix on its type, or from a `weight` or `sign` property, and is exposed to queries and styling.

Example: `-distrusts:: [[Eve]]`. Exact semantics (boolean polarity versus numeric weight) are still open and must be settled before v0.1 ships.

## Edge identity

Each edge gets a derived ID `source#type#target#n`, where `n` is its ordinal among duplicates, and an author may pin it with an `id` property.

Derived IDs shift when duplicate edges are reordered, so anything that references an edge long-term should use a pinned `id`. The plugin warns about referenced edges that are not pinned.

## Property embeds

Edge properties are shown in prose with `{{edge: Alice -knows-> Bob . since}}` or `{{edge: met-2020 . since}}`, both resolved through the same lookup.

Without a trailing property the embed renders the whole property block as a small table. Inside queries, `r.since` is ordinary Cypher property access.

## Edge notes

A note with `type: edge` frontmatter may also declare an edge, as a later escape hatch for Properties panel and Bases integration.

Both forms feed the same [[graph-model|graph model]].
