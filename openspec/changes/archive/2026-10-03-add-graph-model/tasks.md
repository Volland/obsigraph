## 1. Graph model

- [x] 1.1 Implement the graph store (node and edge maps, per-file contribution tracking)
- [x] 1.2 Implement link resolution through an injected resolver and reference-counted stub nodes
- [x] 1.3 Derive node labels from frontmatter `type` (string or list) and expose frontmatter, path and title as properties
- [x] 1.4 Derive edge IDs with ordinals and honor a pinned `id`
- [x] 1.5 Implement incremental add, modify, rename and delete including stub promotion and demotion
- [x] 1.6 Write tests covering every scenario in the graph-model spec

## 2. Sync

- [x] 2.1 Add lat.md test-spec section and `@lat:` refs, link graph symbols from lat.md/graph-model, run `lat check` and `openspec validate`
