## Why

The VS Code extension draws only the active file's neighborhood, so there is no way to see the shape of a whole project: which notes, specs and code files cluster together and which are isolated. People also cannot take a graph out of the editor to share in a review, a README or a slide deck.

## What Changes

- Add a **whole-project scope** to the graph panel. A toggle in the panel switches between "Active file" (today's behavior, still the default) and "Whole project", which draws every indexed node and edge. Large graphs are capped by degree and say so.
- Add the command **TypeGraph: Open Full Graph** (`typegraph.openFullGraph`). It opens the panel already in the whole-project scope. Add a button for it next to Open Graph in the Backlinks view title bar.
- Add **export** of what the panel shows, as a standalone **HTML** file and as a **PDF**: commands **TypeGraph: Export Graph as HTML** (`typegraph.exportGraphHtml`) and **TypeGraph: Export Graph as PDF** (`typegraph.exportGraphPdf`), plus Export HTML and Export PDF buttons in the panel toolbar. The user picks the file in a save dialog.
- Add the setting `typegraph.fullGraphLimit` (default 2000 nodes) that caps the whole-project scope.
- Describe all new commands, buttons and the setting in the extension README, `package.json` and `lat.md/vscode.md`.
- The exported HTML is one self-contained file with no network access and no external scripts, so it keeps the extension's no-telemetry guarantee.

## Capabilities

### New Capabilities
- `graph-export`: Exporting the graph as a standalone HTML page and as a PDF, with the same layout and styling as the panel.

### Modified Capabilities
- `vscode-extension`: the graph panel gains a whole-project scope, a command and buttons for it, and a size limit; `Configurable roots` now allows the export commands to write the file the user chooses.

## Impact

- `packages/vscode`: `package.json` (commands, menus, setting), `src/extension.ts`, `src/graph-session.ts`, new `src/export.ts` (pure HTML and PDF builders), `src/webview/main.ts` (toolbar and capture), a new `src/webview/viewer.ts` bundle for the HTML export, `esbuild.config.mjs`, README and CHANGELOG.
- `packages/graph-ui`: a pure `projectElements(graph, limit)` that returns every node and edge, or the most connected `limit` nodes with a count of what was left out.
- `lat.md/vscode.md` and `lat.md/tests/vscode-extension.md`.
- No new runtime dependencies: the PDF is written by a small builder that embeds a JPEG capture of the graph.
