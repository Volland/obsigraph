# Changelog

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
