## 1. Core

- [x] 1.1 Add `frontmatterEdges()` and `FRONTMATTER_EDGE_SKIP`, reusing the inline link scanner so wikilinks, aliases, subpaths and markdown links read the same way
- [x] 1.2 Add `ParseOptions.frontmatterEdges` and read it in `Graph.upsertNote`, after body edges and before pre-parsed edges
- [x] 1.3 Add `ValidateOptions.frontmatterEdges`

## 2. Hosts

- [x] 2.1 Plugin setting "Frontmatter links as edges" (default off), read at each upsert, with `VaultIndex.reindex()` on change
- [x] 2.2 `tg validate --frontmatter-edges`

## 3. Tests and docs

- [x] 3.1 Core tests for every scenario, and a CLI test for the flag
- [x] 3.2 Document in lat.md/edge-syntax and lat.md/cli, add test specs with `@lat:` refs, update the website docs and the changelog
- [x] 3.3 Run `lat check` and the full test suite
