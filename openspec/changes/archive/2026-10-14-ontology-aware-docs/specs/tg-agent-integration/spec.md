## ADDED Requirements

### Requirement: Ontology-aware guidance
The agent instruction block, the Cursor rules, the bundled skills and the OpenSpec skill patches SHALL teach agents to discover the project's ontology with `tg ontology` before writing docs, to type a docs file by its kind with `type:` frontmatter, to write relations between sections, requirements and code as typed edge lines with the ontology's edge names and to put facts about a relation in the edge's properties, and to run `tg ontology check` with `tg check` when they finish. The OpenSpec config rules SHALL ask that design decisions and constraints of a change be recorded as typed sections with typed edges, and that task lists include `tg ontology check`.

#### Scenario: Instructions teach the ontology
- **WHEN** `tg gen claude.md` runs
- **THEN** the text tells the agent to run `tg ontology`, shows a typed edge line with a property block between two sections, and lists `tg ontology check` in the post-task checklist

#### Scenario: OpenSpec rules teach typed records
- **WHEN** `tg init` adds rules to `openspec/config.yaml`
- **THEN** the design rules ask for `Decision` sections with `motivated_by` edges and the task rules include `tg ontology check`
