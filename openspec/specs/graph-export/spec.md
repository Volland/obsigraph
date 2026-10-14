# graph-export Specification

## Purpose
TBD - created by archiving change vscode-full-graph-export. Update Purpose after archive.

## Requirements

### Requirement: Export the graph as standalone HTML
The VS Code extension SHALL export the graph the panel shows (its current scope, expanded nodes and layout) as a single self-contained HTML file through the command `typegraph.exportGraphHtml` ("TypeGraph: Export Graph as HTML") and an Export HTML button in the panel toolbar. The file SHALL embed its data, styles and script, SHALL load nothing from the network, SHALL let the reader pan, zoom and select a node to see its properties, and SHALL show the nodes at the positions they had in the panel. The extension SHALL ask for the file name in a save dialog and SHALL write nothing else.

#### Scenario: Self-contained file
- **WHEN** the user exports the graph as HTML
- **THEN** the file opens in a browser with no network access and shows the same nodes, edges and type styles as the panel

#### Scenario: Same layout as the panel
- **WHEN** the panel shows a graph the user has arranged and exports it
- **THEN** the exported nodes sit at the panel's positions without running a new layout

#### Scenario: Reader can inspect a node
- **WHEN** the reader selects a node in the exported page
- **THEN** the page lists that node's labels and properties

#### Scenario: Export is cancelled
- **WHEN** the user closes the save dialog without choosing a file
- **THEN** no file is written

### Requirement: Export the graph as PDF
The extension SHALL export the graph the panel shows as a one-page vector PDF through the command `typegraph.exportGraphPdf` ("TypeGraph: Export Graph as PDF") and an Export PDF button in the panel toolbar. The PDF SHALL draw nodes, edges, arrowheads and labels as vector shapes and text at the positions they have in the panel, so it stays sharp at any zoom and its labels can be selected and searched. The page SHALL be sized to the graph's aspect ratio (scaled down only if it would exceed the PDF page limit of 14400 units), SHALL show the whole graph and not only the visible viewport, SHALL use black text on a white background whatever the editor theme, and SHALL carry a caption and document metadata with the scope, the node and edge counts and, when the whole-project scope was capped, how many nodes were left out and the limit. The PDF SHALL be written by the extension without a browser, a library or any download.

#### Scenario: Whole graph on one page
- **WHEN** the graph is larger than the panel and the user exports it as PDF
- **THEN** the PDF page shows every drawn node and edge, not just the part in view

#### Scenario: Vector output
- **WHEN** the extension writes a PDF
- **THEN** it contains path and text drawing operators for the nodes, edges and labels and no embedded raster image, and the label text can be extracted from it

#### Scenario: Print-friendly colors in a dark theme
- **WHEN** the editor uses a dark theme and the user exports the graph as PDF
- **THEN** the PDF has a white background with black labels, and the panel keeps its dark colors

#### Scenario: Size metadata
- **WHEN** the user exports a graph with a known number of nodes and edges
- **THEN** the PDF caption and its Subject metadata state the scope, the node count and the edge count

#### Scenario: Capped graph says so
- **WHEN** the whole-project scope left nodes out because of `typegraph.fullGraphLimit`
- **THEN** the PDF caption states how many nodes were left out and the limit

#### Scenario: Valid PDF
- **WHEN** the extension writes a PDF
- **THEN** the file starts with `%PDF-`, ends with `%%EOF` and has a cross-reference table whose offsets match the objects

### Requirement: Export commands from the editor and the panel
The commands `typegraph.openFullGraph`, `typegraph.exportGraphHtml` and `typegraph.exportGraphPdf` SHALL appear in the Command Palette under "TypeGraph", and the Backlinks view title bar SHALL show buttons for the full graph and for each export. An export command run while no panel is open SHALL open the panel in the active-file scope, wait for it to draw, and then export it. With no workspace folder open, the commands SHALL do nothing and say that a folder is needed.

#### Scenario: Export without an open panel
- **WHEN** the user runs "TypeGraph: Export Graph as HTML" and no graph panel is open
- **THEN** the panel opens, draws the active file's neighborhood and the save dialog then appears

#### Scenario: No folder open
- **WHEN** no workspace folder is open and the user runs an export command
- **THEN** a message says to open a folder and no dialog appears

#### Scenario: Buttons in the title bar
- **WHEN** the Backlinks view is visible
- **THEN** its title bar offers Open Graph, Open Full Graph, Export HTML and Export PDF
