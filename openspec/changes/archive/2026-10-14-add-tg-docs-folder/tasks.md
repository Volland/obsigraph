## 1. CLI

- [x] 1.1 `docsDir(root)`: `lat.md` when it exists, else `tg.md`; root discovery stops at `tg.md/` too
- [x] 1.2 `Project` reads the docs folder it finds and exposes its name; `check`, `export`, `hook` and the lattice commands use it
- [x] 1.3 Hook messages name the project's docs folder

## 2. Init

- [x] 2.1 `--docs lat.md|tg.md`, a single-choice prompt (`Io.select`) when neither folder exists, `lat.md` otherwise; an existing folder always wins, with a note when `--docs` asked for the other
- [x] 2.2 Write the index, ontology guide, instructions and skills for the chosen folder

## 3. Hosts

- [x] 3.1 Obsidian plugin reads `tg.md/` folders in place
- [x] 3.2 VS Code setup detection accepts either folder

## 4. Tests and docs

- [x] 4.1 Tests for every scenario
- [x] 4.2 Update lat.md, test specs and site docs; run `lat check`, `openspec validate --strict` and the suite
