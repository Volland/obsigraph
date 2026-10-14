## Why

`tg init` installs a code ontology (Decision, Requirement, Constraint, Concept, Change; `implements`, `motivated_by`, `constrains`, `supersedes`, `-contradicts`, ...), but agents never use it in the docs. What they write looks like classic lat.md: untyped sections and plain wiki links. Three things cause it:

- **The engine drops typed links in docs.** A line such as `motivated_by:: [[constraints#GDPR]] {since: 2}` inside a lat.md section becomes a plain `references` edge: type, sign and properties are lost, so even a careful author gains nothing. Only `@tg:` comments in code carry typed edges. The ontology guide therefore tells authors to "name the relation in the sentence".
- **Agents cannot discover the ontology.** The types and edge types live as YAML in `Types/`. No command lists them, so an agent cannot ask which edge names exist, which endpoints they connect or which properties they take, and invents synonyms.
- **The instructions and skills teach only `implements` and `verifies` from code.** Nothing tells an agent to type its doc files, write typed edges between sections, put facts such as `since` or `ticket` on the edge, record OpenSpec design decisions as `Decision` sections, or check its edges against the ontology.

## What Changes

- **Typed edges in docs.** A typed edge line in a section of the docs folder (`- motivated_by:: [[constraints#GDPR]] {since: 2}`, sign prefix and property block optional) becomes an edge of that type, sign and properties from the section to the target: a section, an OpenSpec requirement or scenario, or a code node. It replaces the plain `references` edge for that target. The line is still an ordinary wiki link, so lat.md and `tg check` treat it exactly as before.
- **`tg ontology`** lists the project's ontology from its schema folder (`Types/` by default): each type with its properties (kind, allowed values, default, required) and allowed edges, each edge type with its endpoints and properties, and where each is declared. `--json` for scripts, and an MCP tool `tg_ontology` for agents.
- **`tg ontology check`** compares the typed edges actually written, in docs and in code, with the ontology: edge types it does not declare (with a did-you-mean), endpoints whose types the edge type does not allow, and undeclared or out-of-range edge properties. Exit 1 on findings. `tg check` stays identical to lat.md.
- **Ontology-aware instructions, skills and OpenSpec guidance.** The agent instruction block, all five skills, the ontology guide, the OpenSpec skill patches and the OpenSpec config rules teach agents to run `tg ontology` first, type doc files by their kind, write typed edges with properties between sections and to requirements and code, record design decisions and constraints as typed sections, and finish with `tg ontology check`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `tg-cli`: typed edges in docs, `tg ontology` and `tg ontology check`.
- `tg-agent-integration`: ontology-aware instructions and skills, OpenSpec config rules, the `tg_ontology` MCP tool.

## Impact

- `packages/core/src/latmd/markdown.ts`, `graph.ts`: edge lines per file, typed section edges.
- `packages/cli/src/commands/ontology.mts` (new), `mcp-server.mts`.
- `packages/cli/templates/`: `agents.md`, `cursor-rules.md`, the five skills, `ontology/code-ontology.md`, the OpenSpec patches and `config-rules.md`.
- Tests, `lat.md/cli.md`, test specs, site docs, the CLI README.
