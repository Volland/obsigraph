## Context

The panel is a webview running the shared `GraphRenderer` (Cytoscape). The extension host owns the graph and posts plain element data; `GraphSession` merges the active file's neighborhood with expanded nodes. The extension bundles everything, writes no files while indexing, and has a test that it imports no networking module.

## Goals / Non-Goals

**Goals:**
- See the whole indexed project in the panel, with a toggle and a command.
- Export what the panel shows as standalone HTML and as PDF, from commands and panel buttons.
- No new runtime dependency, no network access, no headless browser.

**Non-Goals:**
- Filtering by type, folder or edge type in the whole-project scope. The limit is the only control for now.
- Multi-page PDFs and embedded fonts for non-Latin-1 text.
- Exports from the Obsidian plugin or the `tg` CLI. The pure builders are placed so they can be reused later.
- Editing the graph from the exported HTML.

## Decisions

**Scope lives in `GraphSession`.** `GraphSession` gets a `scope: 'file' | 'project'`. In `project` scope `elements()` ignores the active file and returns `projectElements(graph, limit)`; expansions are irrelevant because everything is drawn. Switching scope clears expansions. The scope is panel state, not a setting, so every new panel opens in `file` scope, except through `typegraph.openFullGraph`.

**`projectElements` is pure and lives in `graph-ui` next to `neighborhood`.** It returns `{ elements, total, shown }`. Over the limit it keeps the nodes with the highest degree (ties broken by id so the result is stable) and only the edges between kept nodes. Stubs count as nodes. The host posts `{ type: 'elements', elements, scope, omitted }` and the webview shows a one-line banner when `omitted > 0`.

**The toolbar is DOM in the webview.** A thin bar above the graph holds the scope toggle, Export HTML and Export PDF. The toggle and buttons post messages to the host (`scope`, `export`). Title-bar buttons and Command Palette commands go through the same path: the host posts `{ type: 'capture', format }` to the webview, which replies with what it needs. One code path for the button and the command.

**HTML export embeds a second bundle.** `esbuild.config.mjs` builds `dist/viewer.js` from `src/webview/viewer.ts`: the shared `GraphRenderer` over data in `window.__TYPEGRAPH__`, with pan, zoom and a details panel for the selected node. `src/export.ts#buildHtml` is pure: it takes elements, node positions, theme colors and the viewer script text and returns one HTML string. Data goes in a `<script type="application/json">` with `<` escaped so a note title cannot close the tag. Positions are applied after `setElements`, so the page shows the panel's layout without running one. The CSP of the file is `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:`, which also proves it cannot load anything.

**PDF is drawn as vectors from a scene.** The webview reads a plain scene from Cytoscape (node positions, size, shape, color, label; edge endpoints, color, dash, sign, type) and posts it. Colors come from element data set by the styler, not from the theme, so the scene needs no light stylesheet and labels are always black on white. `src/pdf.ts#buildGraphPdf(scene)` is pure and writes PDF 1.4 by hand: catalog, pages, one page, a content stream and the base-14 Helvetica font with WinAnsi encoding, an Info dictionary (Title, Subject with scope and counts, Creator, CreationDate) and the xref table. Nodes are filled paths (ellipse as four Bézier arcs; rectangle, rounded rectangle, diamond, hexagon, triangle and star as polygons), stubs are drawn dashed and pale, edges are lines (parallel edges between one pair are bent apart with a quadratic curve) with a filled arrowhead or a tee for negative edges, and labels are text. Edge-type labels are drawn only up to 400 edges to keep a dense graph readable. The page is the graph's bounding box plus margins and a caption band; positions are in points 1:1 and the whole drawing is scaled down only if a side would pass 14400. The trade-off is Helvetica's character set: characters outside Latin-1 are drawn as `?` (the HTML export keeps full Unicode), and label widths are estimated from Helvetica metrics for the bounding box. Chosen over a JPEG capture because it stays sharp and searchable and needs no canvas limits.

**Writing files.** The host shows `showSaveDialog` with a default name `typegraph-<scope>.html` or `.pdf` in the workspace folder, and writes only that URI with `workspace.fs.writeFile`. The "never write while indexing" rule is kept and the `Configurable roots` requirement now names the export commands.

**Exports with no open panel.** The command opens the panel in `file` scope, waits for the webview's `ready` message and the first `elements` message, then captures. A timeout of 10 seconds shows an error instead of hanging.

## Risks / Trade-offs

- [A graph of thousands of nodes is slow to lay out] → The default limit is 2000 and is a setting. The layout runs once per element set, not per file change, because `setElements` keeps positions when the set is unchanged. A change that adds nodes in project scope re-lays out the whole graph; acceptable at the limit.
- [PDF page limit of 14400 units] → Scale the drawing down uniformly past that; text sizes scale with it.
- [Exported HTML contains project content] → It is written only where the user chooses and the README says it contains the labels and properties of every drawn node. Nothing is uploaded.
- [Non-Latin labels in the PDF] → Drawn as `?` and documented; the HTML export carries them intact.
- [Two bundles drift] → The viewer and the panel share `GraphRenderer` and the stylesheet builder from `graph-ui`; the viewer adds only the details panel.

## Open Questions

- Should the PDF keep the dark theme when the user asks for it? Assumed no: print-friendly always.
- Should the PDF embed a Unicode font? Deferred; it would add hundreds of kilobytes to the extension.
