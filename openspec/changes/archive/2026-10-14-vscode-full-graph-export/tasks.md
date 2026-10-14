## 1. Whole-project scope

- [x] 1.1 Add `projectElements(graph, limit)` to `graph-ui` returning elements, total and omitted counts, keeping the highest-degree nodes with stable tie-breaking
- [x] 1.2 Add a `scope` to `GraphSession`: `project` ignores the active file and expansions, switching scope clears expansions
- [x] 1.3 Add the `typegraph.fullGraphLimit` setting and read it in the adapter
- [x] 1.4 Post `scope` and `omitted` with the elements; show the capped-graph banner in the webview

## 2. Panel toolbar and commands

- [x] 2.1 Add the webview toolbar with the Active file / Whole project toggle and the Export HTML and Export PDF buttons
- [x] 2.2 Register `typegraph.openFullGraph`, `typegraph.exportGraphHtml` and `typegraph.exportGraphPdf` with titles and icons in `package.json`
- [x] 2.3 Add the four title-bar buttons to the Backlinks view menu, and the commands to the Command Palette
- [x] 2.4 Open the panel on demand for the export commands, wait for the first draw with a 10 second timeout, and report the no-folder case

## 3. HTML export

- [x] 3.1 Build `dist/viewer.js` from `src/webview/viewer.ts` with pan, zoom and a node details panel
- [x] 3.2 Implement the pure `buildHtml` in `src/export.ts`: embedded JSON with escaping, positions, theme colors, restrictive CSP
- [x] 3.3 Capture node positions in the webview and send them with the export request; write the chosen file from the host

## 4. PDF export

- [x] 4.1 Implement the pure `buildGraphPdf(scene)` in `src/pdf.ts`: vector nodes, edges, arrowheads, labels, caption, Info metadata, correct xref offsets, page limit scaling
- [x] 4.2 Read the scene (positions, size, shape, color, labels, edges) from Cytoscape in the webview and post it
- [x] 4.3 Compose the caption and Subject: scope, node and edge counts, nodes left out and limit, date

## 5. Tests

- [x] 5.1 Test `projectElements` and `GraphSession` for the open, toggle, cap and live-update scenarios
- [x] 5.2 Test `buildHtml` is self-contained, escapes `</script>` in labels, carries positions and has the restrictive CSP
- [x] 5.3 Test `buildGraphPdf` yields a valid structure (header, trailer, xref offsets), vector operators and extractable label text with no image, the size metadata, the capped caption and page scaling
- [x] 5.4 Extend the privacy test so the new bundles still import no networking module
- [x] 5.5 Test the manifest: the three commands, the title-bar menu entries and the setting exist

## 6. Docs and sync

- [x] 6.1 Describe the commands, buttons, scope toggle, limit setting and export formats in `packages/vscode/README.md`, the website docs and `CHANGELOG.md`
- [x] 6.2 Update `lat.md/vscode.md` (Graph webview, new Export section) and `lat.md/tests/vscode-extension.md` with `@lat:` refs in tests
- [x] 6.3 Annotate code with `@tg: implements::` and tests with `@tg: verifies::`; `tg check` and `tg trace vscode-extension graph-export --gaps` show no new gaps
- [x] 6.4 Run `lat check`, `openspec validate vscode-full-graph-export --strict` and the full test suite; bump the extension version on release
