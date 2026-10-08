## Why

Thirty-two OpenSpec capabilities hold the project's requirements, but nothing connects a requirement to the code that implements it, the test that verifies it or the lat.md section that explains it. `@lat:` can only point at `lat.md/` sections, and no file in the repo mentions `openspec` at all. So nobody can answer "is this requirement implemented, and which test proves it?" without reading the code, and specs drift from code silently. The code ontology already declares `Requirement` and `Scenario` types and `implements` and `verifies` edges, but they have nothing to attach to.

## What Changes

- `tg` reads `openspec/specs/<capability>/spec.md` and the spec deltas of active changes, and turns every requirement and scenario into an addressable target: `openspec:<capability>#<Requirement>` and `openspec:<capability>#<Requirement>#<Scenario>`.
- Code and tests point at them with the existing `@tg:` grammar: `// @tg: implements:: [[openspec:tg-annotations#tg annotations]]` above a function, `// @tg: verifies:: [[openspec:tg-annotations#tg annotations#Negative edge]]` above a test. `@lat:` is unchanged, so `lat check` parity holds.
- A `@tg:` annotation directly above a test call (`it(`, `test(`, `describe(`) attaches to the file without a warning and records the test name on the edge.
- lat.md files name the capabilities or requirements they explain in frontmatter: `openspec: [tg-annotations, "tg-check#Check"]`. lat.md ignores the key.
- `tg check` reports `openspec:` targets that do not resolve, with a suggestion, and unknown names in `openspec:` frontmatter. It does not require coverage, so an untraced project still passes.
- New `tg trace [capability...] [--json] [--strict] [--gaps]` prints the traceability matrix: for each requirement, its implementing symbols, verifying tests per scenario and explaining lat.md sections. `--strict` exits 1 when a requirement has no implementation or a scenario has no verification.
- `tg cypher` and the MCP server gain `Requirement` and `Scenario` nodes, linked by `contains` and reached by `implements`, `verifies` and `references` edges, and a `tg_trace` MCP tool.

## Capabilities

### New Capabilities
- `tg-trace`: the OpenSpec reader, requirement and scenario ids, `openspec:` frontmatter in lat.md, the `tg trace` command and the requirement nodes in the section graph.

### Modified Capabilities
- `tg-annotations`: annotations may target `openspec:` ids, and an annotation above a test call attaches to the file with the test name.
- `tg-check`: validates `openspec:` targets and frontmatter.

## Impact

- `packages/core`: new `src/openspec/` (spec parser and `SpecIndex`), `checkLattice` and `buildLatGraph` take an optional spec index, `scanAnnotations` learns test-call attachment.
- `packages/cli`: `Project.specIndex()`, new `trace` command, `tg_trace` MCP tool.
- Source and test files across the repo gain `@tg: implements::` and `@tg: verifies::` annotations; lat.md files gain `openspec:` frontmatter.
- `lat.md/cli.md`, a new test-spec file and the code ontology note describe the feature.
