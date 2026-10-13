## Why

Notes often record relationships as frontmatter properties, because that is what the Properties panel, Bases and templates edit: `requirement: "[[Login]]"`, `member_of: ["[[Finance]]"]`. The graph ignores them. Only `type::` lines in the body become edges, so a vault modelled in properties has a schema that declares edge types and a graph with no edges to check or draw, and the author has to repeat every relation as a body line.

## What Changes

- A new `frontmatterEdges` graph option. When on, each wikilink or markdown link in a frontmatter property value, or list of values, becomes an edge from the note to the target, typed by the property name, sign +1, no properties, line 0 and no heading.
- Values without links, empty `[[]]` placeholders (what templates leave behind) and `tags`, `aliases`, `cssclasses`, `type` and `types` give no edges.
- The option is off by default, so existing vaults keep their graphs and queries. The plugin exposes it as "Frontmatter links as edges" (re-indexes on change), and `tg validate --frontmatter-edges` and `ValidateOptions.frontmatterEdges` apply it to validation so CI sees what the plugin sees.
- Schema edge-type declarations (`from`, `to`) and per-type `edges` apply to these edges unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `edge-parsing`: links in frontmatter properties can become typed edges.

## Impact

- `packages/core`: `frontmatterEdges()` and `FRONTMATTER_EDGE_SKIP` in `edges/parse.ts`, `ParseOptions.frontmatterEdges`, read in `Graph.upsertNote`; `ValidateOptions.frontmatterEdges`.
- `packages/plugin`: setting, `VaultIndex.reindex()`.
- `packages/cli`: `tg validate --frontmatter-edges`.
- Not wired in this change: the sidecar and the VS Code extension, which keep the default (off).
- `lat.md/edge-syntax`, `lat.md/cli`, `site/docs.html`, tests.
