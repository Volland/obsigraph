## Why

Google Cloud's Open Knowledge Format (OKF, v0.2) is becoming a common exchange format for agent-facing knowledge: a folder of markdown concepts with YAML frontmatter, a required `type`, and standard markdown links. Typed Graph already uses frontmatter `type` for labels, but it only reads `[[wikilinks]]`, so an OKF bundle loads as nodes without edges, and a vault cannot be shipped as a conformant bundle.

## What Changes

- Edge lines accept standard markdown links as targets: `knows:: [Bob](/people/bob.md) {since: 2020}`. Bundle-absolute (`/x.md`) and relative (`./x.md`, `../x.md`) paths resolve against the bundle root and the source note's folder. External URLs are not edges.
- Optional plain link edges: with the option on, every plain wikilink or markdown link to a note in prose becomes an untyped `links_to` edge, which matches how OKF consumers read links. Off by default, so existing graphs do not change. The sidecar enables it with `OBSIGRAPH_LINK_EDGES=1`.
- `tg export <out> --format okf`: projects a vault into an OKF v0.2 bundle. Wikilinks become bundle-absolute markdown links, typed edge lines keep their type, sign and properties (so tg reads the bundle back into the same typed graph), every concept gets a string `type` (default `Note`) and a `title` and `description` when missing, reserved `index.md` and `log.md` notes are renamed, and every directory gets a generated `index.md`, the root one declaring `okf_version: "0.2"`. A change report lists what was added or changed.
- `tg okf check [dir]`: validates a bundle against OKF v0.2 conformance (section 11) and reports soft issues as warnings.
- Decision: OKF has no typed links, so typed edges are kept as prose (`type:: [link](path)`), which OKF explicitly allows ("the kind is conveyed by the surrounding prose").

## Capabilities

### New Capabilities
- `okf-compat`: OKF export projection, change report, conformance check.

### Modified Capabilities
- `edge-parsing`: markdown link targets in edge lines.
- `graph-model`: optional plain link edges.

## Impact

- Core: edge parser, graph options, new `okf/` module (export and check, no new dependencies).
- CLI: `export --format okf`, new `okf check` command; parses YAML with the bundled `yaml` package.
- Sidecar: `OBSIGRAPH_LINK_EDGES` setting.
- Docs: lat.md sections, website article on getting a vault OKF-ready.
