# TypeGraph for VS Code

Typed backlinks and a graph view for the markdown and code in your workspace, with no Obsidian required.

## What you get

- **Backlinks panel.** Open a note and see every note that links to it, grouped by edge type (`knows::`, `blocks::`, ...), with the sign (`-distrusts::` shows as a minus) and edge properties. Click to jump to the line.
- **Code and spec together.** Open a source file and see the `lat.md` sections its `// @lat: [[...]]` annotations point at. Open a section and see the source files that point back at it.
- **Graph view.** `TypeGraph: Open Graph` shows the active file's neighborhood; right-click or long-press a node to expand it, double-click to open it.
- **New typed notes.** `TypeGraph: New Typed Note` creates a note from a type in your schema folder with its template and generated ids (UUID, time-ordered UUID, timestamp or Luhmann). `New Child Note` and `New Sibling Note` branch a Luhmann id from the active note. Nothing is written until you run a command, and nothing is overwritten.
- **Set up TypeGraph.** For projects without `lat.md/` or `tg` agent setup, one button runs `tg init` (a global `tg` if you have one, otherwise `npx @typedgraph/cli init`) in a visible terminal, after listing the files it will create or change and asking you to confirm.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `typegraph.schemaFolder` | `Types/` | Folder whose notes declare types, used by the New Typed Note commands. |
| `typegraph.roots` | `["."]` | Folders, relative to the workspace folder, that form the graph. |
| `typegraph.ignore` | `["node_modules"]` | Folder names skipped at any depth. Dot folders are always skipped. |

## Privacy

The extension reads files in your workspace and never writes to them. It collects no telemetry and makes no network requests; only the setup button, when you confirm it, runs a command that may download the CLI.

## Edge syntax

Typed edges look like `knows:: [[Bob]] {since: 2020}`; a leading `-` makes an edge negative. See the [project README](https://github.com/Volland/obsigraph) for the full syntax, the `tg` CLI and the Obsidian plugin.
