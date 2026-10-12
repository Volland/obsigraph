## 1. Shared view-state

- [x] 1.1 Classify rows as note or technical in `nodeDetails` and `edgeDetails`, given the declared property names, and expose raw values and the link source
- [x] 1.2 Add `valueLines`, splitting a value into text and link parts

## 2. Graph view

- [x] 2.1 Build the panel from the classified rows: note properties first, Technical and Links toggles, links that open notes
- [x] 2.2 Add the drag handle, redraw the graph while dragging and remember the width and toggles

## 3. Tests and docs

- [x] 3.1 Tests for row classification and value splitting; the leaf itself stays a manual check
- [x] 3.2 Document in lat.md/visualization, add test specs with `@lat:` refs and update the changelog
- [x] 3.3 Run `lat check` and the full test suite
