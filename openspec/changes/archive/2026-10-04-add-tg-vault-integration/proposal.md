## Why

A `lat.md/` folder must work inside an Obsidian vault (clicking nested-heading and code links), and vault content must be shareable as a lat.md folder for people and CI that use lat tooling.

## What Changes

- In place: a `lat.md/` folder inside the vault, or a vault rooted at a project, is read by the plugin through the lat resolver; clicks, hover and backlinks work for nested-heading and code links; files are never rewritten.
- `tg export`: project a vault subset into a lat-conformant folder. Typed edges and properties are dropped or flattened to plain links, nested links are normalized, and the leading-paragraph and link rules are verified.
- `tg import`: adopt an existing `lat.md/` by copying or mounting it into a vault.
- Decision: export is lossy by design; round-tripping a vault through lat.md is not guaranteed.
- Assumption: Obsidian cannot resolve `#Heading#Sub` natively, so the plugin installs link handlers rather than rewriting files.

## Capabilities

### New Capabilities
- `lat-vault-integration`: In-place reading in the plugin, and the export and import projection.

### Modified Capabilities
- `graph-model`: links resolved through the lat resolver inside a lat.md folder.

## Impact

- Plugin link handling and settings; new `export` and `import` commands; documentation of the lossy projection.
- Depends on the resolver, check commands and code layer.
