## 1. OpenSpec index

- [x] 1.1 Parse spec files and change deltas into capabilities, requirements and scenarios (`packages/core/src/openspec/`)
- [x] 1.2 `SpecIndex` with id resolution, pending status, removed names and fuzzy suggestions

## 2. Annotations and check

- [x] 2.1 Test-call attachment in `scanAnnotations` with the `test` edge property
- [x] 2.2 `checkLattice` validates `openspec:` targets and `openspec:` frontmatter through an optional spec index
- [x] 2.3 `Project.specIndex()` reads `openspec/` from the project root

## 3. Graph and command

- [x] 3.1 `Requirement` and `Scenario` nodes and their edges in `buildLatGraph`
- [x] 3.2 `tg trace` with `--gaps`, `--json`, `--strict` and exit codes
- [x] 3.3 `tg_trace` MCP tool

## 4. Tests

- [x] 4.1 Tests for every scenario in the tg-trace, tg-annotations and tg-check deltas, with `@lat:` refs to a new test-spec file

## 5. Annotate and document

- [x] 5.1 Annotate implementing symbols with `@tg: implements::` and tests with `@tg: verifies::` across the repo
- [x] 5.2 Add `openspec:` frontmatter to lat.md files
- [x] 5.3 Document in `lat.md/cli.md`, the code ontology template and the agent skill
- [x] 5.4 Run `tg check`, `lat check`, `openspec validate --all --strict` and the full test suite
