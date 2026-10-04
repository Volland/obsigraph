---
lat:
  require-code-mention: true
---
# VS Code Extension Tests

Test specifications for the VS Code extension described in [[vscode]]; the VS Code adapter itself is verified manually, so every behavior listed here lives in pure modules tested without VS Code.

## Indexer

How the workspace index builds and maintains the graph.

### Roots and ignores

Only folders listed as roots are indexed, and dot folders and ignored folder names such as `node_modules` never enter the graph.

### Live update

Saving a note with a new typed edge, or deleting a note, changes the graph and the backlinks without reloading the index.

### Read-only

Indexing leaves every file in the workspace byte-identical.

## Backlinks

What the panel shows for the active file.

### Grouped by type

Incoming edges of a note are grouped by edge type, sorted, with the source note and line of each edge.

### Negative edge sign

An incoming negative edge carries sign minus so the panel can mark it.

### Code to spec

An active source file lists the notes its annotations point at, with the link as written including its heading.

### Spec to code

An active note lists the source files that annotate it, separately from its typed note edges.

### Empty states

A file with no edges, a file outside the roots and an unknown path all yield an empty result instead of an error.

## Graph session

The graph webview's state outside the webview.

### Expanded nodes survive refresh

Expanding a node adds its neighborhood to the active file's, and a later refresh after a graph change keeps it while dropping nodes that no longer exist.

## Set up TypeGraph

The funnel to `tg init`.

### Confirmation first

The confirmation lists the files before any command runs, and declining runs nothing.

### Global tg preferred

A global `tg` runs `tg init --write`, otherwise the command falls back to the published CLI through `npx`.

### File list matches the CLI

The files the confirmation lists are exactly those `tg init` plans for a fresh project, so the dialog never drifts from the CLI.

### Detects finished setup

A workspace with `lat.md/` and a tg-managed instruction block needs no setup, and one without either does.

## Privacy

Guarantees about what the extension never does.

### No telemetry

The extension sources import no networking module and call no `fetch`, so nothing can be sent anywhere.

## Release

Publishing to both registries.

### Refuses with a missing token

The release script stops before publishing to either registry when one of the two tokens is missing.

### Same package to both

With both tokens present the script publishes the same `.vsix` file to the Marketplace and to Open VSX.
