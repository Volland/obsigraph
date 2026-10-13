## Why

The Graph view's details panel is a fixed 220 px column that lists everything the graph knows about the selection in one flat table. Values are cut off, a note's own properties are mixed with bookkeeping (`labels`, `stub`, `path`, `style.color` and four more style rows), and a property that links to another note shows as raw text, or as JSON for a list (`["[[Data Governance|...`), so the user cannot follow it.

## What Changes

- The panel can be resized with a drag handle between the graph and the panel; the graph redraws while dragging and the width is remembered. Long values wrap.
- Rows are split into note properties and technical rows. Technical rows are the node's labels, stub flag, path and every style row, an edge's sign, ID, declaring note and heading, and properties that the node's schema (or the edge type's declaration) does not declare. A Technical toggle, off by default, shows them. Note properties are listed first.
- Wikilinks and markdown links in property values are drawn as links that open the note, one list item per line, with a Links toggle (on by default) to get the old plain text back.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `graph-view`: the details panel gets the layout, row classification and link rendering above.

## Impact

- `packages/graph-ui`: `Details` gains `technical`, `values` and `source`; `nodeDetails` and `edgeDetails` take the declared property names; `valueLines` splits values into text and link parts. Existing `rows` are unchanged.
- `packages/plugin`: the Graph view builds the panel from them, with the handle and the two toggles; styles. Preferences are device-local (`app.saveLocalStorage`), not plugin settings.
- `lat.md/visualization`, `lat.md/tests/graph-view`, tests.
