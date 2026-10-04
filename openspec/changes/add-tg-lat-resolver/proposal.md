## Why

A `lat.md/` folder uses ids Obsidian and the current parser cannot resolve: nested headings (`file#Heading#Sub`), short file names, and source targets (`src/foo.ts#fn`). Without a resolver, such a folder yields broken links and stub nodes. Parity with lat.md starts here.

## What Changes

- Pure section-tree parser in `packages/core` (new `latmd` module): headings to nested sections, leading paragraph, frontmatter `lat:` options.
- lat-compatible id model: full form `lat.md/path/file#H#Sub`, short form `file#H#Sub` when the file name is unique, same fuzzy rules as `lat locate`.
- Wiki-link extraction `[[target]]` and `[[target|alias]]` outside code, resolving to a section, a file, or a code target.
- Decision: reuse the repo's existing markdown and frontmatter handling; no remark dependency in `core`.
- Assumption: lat.md 0.12 behavior is the reference; divergences are recorded in a differences file like the engine conformance suite.

## Capabilities

### New Capabilities
- `lat-resolver`: Section tree, ids, and link resolution compatible with lat.md.

### Modified Capabilities
- `graph-model`: links to nested headings no longer create stub nodes inside a lat.md folder.

## Impact

- New `packages/core/src/latmd/`, exported from `core`; used by the CLI, plugin and sidecar. Existing vaults without `lat.md/` see no change.
