# Changelog

## 0.8.2

- Setup now lists the three new `tg` skills (`tg-trace`, `tg-impact`, `tg-audit`) among the files `tg init` will create.

## 0.8.1

- The graph clears expanded nodes when you switch to another file, as in Obsidian; expansions still survive refreshes of the same file, and the last file stays shown while focus is in the graph.
- The Backlinks view says when the active file is outside `typegraph.roots`, and shows the "Set up TypeGraph" offer as the welcome view or as a row below the backlinks.

## 0.8.0

- **New typed notes.** `TypeGraph: New Typed Note` (command palette, the Explorer folder menu and the Backlinks title bar) creates a note from a type declared in your schema folder (`typegraph.schemaFolder`, default `Types/`), using the type's template and never overwriting a file.
- **Generated ids.** Types can ask for ids with the new `id` key of TGS 0.2: a random UUID, a time-ordered UUID v7, a timestamp, or a Luhmann id.
- **Luhmann branching.** `TypeGraph: New Child Note` and `New Sibling Note` create the next free id (`1` to `1a` to `1a1`, `1b`, `2`) next to the active note, with a link back through the template.
- Templates may use `{{title}}`, `{{date}}`, `{{id}}`, `{{parent-link}}` and more.
- The extension now writes files, but only the notes you create with these commands.

## 0.7.0

- Setup now installs `tg` 0.7.0, which adds `tg schema export` and `tg schema import` for exchanging Typed Graph Schema notes with SHACL. The extension itself does not read schema notes, so nothing else changes in the editor.

## 0.6.0

- Typed edges written with markdown links (`knows:: [Bob](/people/bob.md)`) show up in backlinks and the graph, so Open Knowledge Format bundles work.
- A frontmatter `title` is used as the node title in the graph.
- Published on Open VSX as `pavlyshyn.typegraph-vscode`; the manifest's publisher now matches.

## 0.5.0

- Typed backlinks panel for the active markdown note or source file, grouped by edge type with sign and properties.
- Source files show the `lat.md` sections their `@lat` annotations point at, and sections show the code that points back.
- Graph view of the active file's neighborhood, with click-to-expand, using VS Code theme colors.
- "Set up TypeGraph" runs `tg init` in a visible terminal after you confirm the files it will touch.
- `typegraph.roots` and `typegraph.ignore` settings. No telemetry.
