# Changelog

## 0.5.1

- Fix: the "Set up TypeGraph…" row now shows in the Backlinks view (the welcome view it relied on never appeared).
- A fuller README with examples, settings, limits and troubleshooting.

## 0.5.0

- Typed backlinks panel for the active markdown note or source file, grouped by edge type with sign and properties.
- Source files show the `lat.md` sections their `@lat` annotations point at, and sections show the code that points back.
- Graph view of the active file's neighborhood, with click-to-expand, using VS Code theme colors.
- "Set up TypeGraph" runs `tg init` in a visible terminal after you confirm the files it will touch.
- `typegraph.roots` and `typegraph.ignore` settings. No telemetry.
