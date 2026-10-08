---
openspec: [edge-embeds, edge-parsing, graph-model]
---
# Edge Syntax

How authors write typed, signed edges with properties inside markdown, and how edges are identified and embedded elsewhere.

## Inline edge form

An edge is a single line `type:: [[Target]] {props}` where the property block is optional, so plain Graph Link Types lines stay valid unchanged.

Implemented by [[packages/core/src/edges/parse.ts#parseEdges]], with property blocks parsed by [[packages/core/src/edges/props.ts#parseProps]]. Example: `knows:: [[Bob]] {since: 2020, label: "met at conf"}`. List items and comma-separated links are accepted; YAML frontmatter and fenced code are skipped. Source heading is recorded as edge metadata so sub-note nodes can be added later without breaking edges.

## Markdown link targets

A standard markdown link to a note works as an edge target, alone or mixed with wikilinks: `knows:: [Bob](/people/bob.md) {since: 2020}`.

Parsed by [[packages/core/src/edges/parse.ts#markdownTarget]], which normalizes the destination to a vault path: percent escapes decoded, `#anchor` kept as the subpath, `./` and `../` resolved against the source note's folder, a leading `/` meaning the vault root, `.md` added when there is no extension. Links with a URL scheme, pure anchors, directory links and links to non-note files are not edges. This is what makes [[okf]] bundles and exports readable as typed graphs.

## Sign

An edge's sign comes from a `+` or `-` prefix on its type, defaults to +1, and is exposed to queries and styling.

Example: `-distrusts:: [[Eve]]`. v0.1 assumes sign is a +1/-1 polarity from the prefix only, default +1; `weight` is an ordinary property. This assumption is open for revision.

## Edge identity

Each edge gets a derived ID `source#type#target#n`, where `n` is its ordinal among duplicates, and an author may pin it with an `id` property.

Derived IDs shift when duplicate edges are reordered, so anything that references an edge long-term should use a pinned `id`. [[packages/core/src/embeds/embeds.ts#EmbedIndex]] warns about edges referenced by endpoint embeds that are not pinned, suggesting an id such as `alice-knows-bob`, and about ambiguous endpoint embeds; pinned or unreferenced edges never warn.

## Property embeds

Edge properties are shown in prose with `{{edge: Alice -knows-> Bob . since}}` or `{{edge: met-2020 . since}}`, both resolved through the same lookup.

Without a trailing property the embed renders the whole property block as a small table. Inside queries, `r.since` is ordinary Cypher property access.

A sign goes inside the arrow before the type: `-knows->` matches either sign, `--knows->` only negative, `-+knows->` only positive. Endpoints may be wrapped in `[[ ]]`. Parsed by [[packages/core/src/embeds/embeds.ts#parseEmbed]] and resolved by [[packages/core/src/embeds/embeds.ts#resolveEmbed]]; duplicates resolve to the lowest ordinal. Embeds in code are ignored. They render in reading view through a post-processor and in live preview through a CodeMirror widget that reveals the raw text under the cursor; both re-resolve on vault changes. Unresolved embeds show a marker, never an error.

## Edge notes

A note with `type: edge` frontmatter may also declare an edge, as a later escape hatch for Properties panel and Bases integration.

Both forms feed the same [[graph-model|graph model]].
