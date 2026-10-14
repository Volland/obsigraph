## ADDED Requirements

### Requirement: Typed edges in docs
A typed edge line in a section of the docs folder, of the form `type:: [[target]] {props}` with an optional `+` or `-` sign prefix, list marker and property block, SHALL become an edge of that type, sign and properties in the section graph, from the deepest section containing the line to the resolved target: a section, an OpenSpec requirement or scenario, or a code node in the graph. It SHALL replace the plain `references` edge from that section to the same target. Lines in code fences and links that do not resolve SHALL add no typed edge. The line SHALL remain an ordinary wiki link for `tg check`.

#### Scenario: Decision motivated by a constraint
- **WHEN** a section of `decisions.md` contains `- motivated_by:: [[constraints#GDPR]] {since: 2}`
- **THEN** `tg cypher "MATCH (d)-[r:motivated_by]->(c) RETURN d.title, c.title, r.since"` returns that pair with `since` 2, and no `references` edge joins them

#### Scenario: Negative edge to a requirement
- **WHEN** a section contains `- -contradicts:: [[openspec:auth#Token expiry]] {ticket: "PLAT-481"}`
- **THEN** the section graph has a `contradicts` edge with sign -1 and property `ticket` to that requirement

#### Scenario: Code fence ignored
- **WHEN** a typed edge line appears inside a fenced code block of a section
- **THEN** no typed edge is added for it

### Requirement: Ontology listing
`tg ontology [--schema-folder Types] [--json]` SHALL list the types and edge types declared by the schema notes directly in the schema folder of the project root (`Types/` by default): for each type its properties with kind, allowed values, default and whether required, its allowed edges with target types, and the declaring note; for each edge type its source and target types, properties and declaring note. With no schema notes it SHALL say so and exit 0. The same listing SHALL be available to MCP clients as the `tg_ontology` tool.

#### Scenario: Code ontology listed
- **WHEN** `tg ontology --json` runs in a project set up by `tg init`
- **THEN** it lists six types including `Decision` with property `status` and eleven edge types including `motivated_by` from `Decision` to `Constraint`, `Concept` and `Decision`

#### Scenario: No ontology
- **WHEN** `tg ontology` runs in a project without a `Types/` folder
- **THEN** it reports that no ontology is declared, names `tg init` to install one, and exits 0

### Requirement: Ontology check
`tg ontology check [--schema-folder Types] [--json]` SHALL report every typed edge in docs and in code annotations whose type the ontology does not declare, with the closest declared name as a suggestion; every edge whose source or target carries types and none of them is allowed by the edge type's `from` or `to`; and every edge property the edge type does not declare or whose value is outside its allowed values. `references`, `contains` and edges written by `@lat:` comments SHALL NOT be reported. It SHALL exit 0 without findings and 1 with findings, and SHALL report nothing when the project declares no ontology.

#### Scenario: Unknown edge name
- **WHEN** a doc section contains `- motivatedBy:: [[constraints#GDPR]]`
- **THEN** `tg ontology check` reports `motivatedBy` as undeclared, suggests `motivated_by`, and exits 1

#### Scenario: Wrong endpoint type
- **WHEN** a section of a file typed `Concept` contains `- supersedes:: [[decisions#Old cache]]`
- **THEN** the check reports that `supersedes` does not allow a `Concept` source

#### Scenario: Clean ontology use
- **WHEN** every typed edge uses a declared type with allowed endpoints and properties
- **THEN** the check prints that the edges agree with the ontology and exits 0
