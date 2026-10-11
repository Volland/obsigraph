## ADDED Requirements

### Requirement: Edge notes
The system SHALL treat a note whose frontmatter `type` is `edge` (or a list containing `edge`) as an edge note: it SHALL contribute exactly one edge and no node. The edge SHALL go from the note named by frontmatter `from` to the note named by `to`, each written as a wikilink, a markdown link or bare link text, resolved like written links, with stubs for missing notes. Its type SHALL be frontmatter `edgeType`, whose `+` or `-` prefix sets the sign as in inline edges. Its ID SHALL be frontmatter `id` when present and the note's path otherwise. Every other frontmatter field except `type` and `types` SHALL become an edge property. The edge SHALL record the edge note's path as its declaring file. The note body SHALL contribute no edges.

#### Scenario: Edge note becomes an edge
- **WHEN** `Alice knows Bob.md` has frontmatter `type: edge`, `from: "[[Alice]]"`, `to: "[[Bob]]"`, `edgeType: knows`, `since: 2020`
- **THEN** the graph has a `knows` edge from `Alice.md` to `Bob.md` with property `since` = 2020 and ID `Alice knows Bob.md`, and no node `Alice knows Bob.md`

#### Scenario: Negative edge note
- **WHEN** an edge note has `edgeType: -distrusts`
- **THEN** its edge has type `distrusts` and sign -1

#### Scenario: Missing endpoint becomes a stub
- **WHEN** an edge note has `to: "[[Nobody]]"` and no note `Nobody` exists
- **THEN** the edge points to a stub `Nobody`, and creating `Nobody.md` re-points it to the real node

#### Scenario: Incomplete edge note
- **WHEN** an edge note has no `edgeType`
- **THEN** it contributes no edge and no node, and an `edge-note` diagnostic names the missing field

### Requirement: Links to edge notes
The system SHALL NOT create an edge whose endpoint resolves to an edge note, and SHALL report an `edge-note` diagnostic at the line of the link, because edge notes are not nodes. When an edge note changes back into an ordinary note, such links SHALL resolve to it.

#### Scenario: Inline edge to an edge note
- **WHEN** a note has `about:: [[Alice knows Bob]]` and `Alice knows Bob.md` is an edge note
- **THEN** no `about` edge exists and an `edge-note` diagnostic points at that line

### Requirement: Findings at the declaring file
The system SHALL report schema validation findings about an edge, and embed warnings that cite an edge's location, at the edge's declaring file when it differs from the edge's source.

#### Scenario: Edge property validated in the edge note
- **WHEN** a schema requires `since` on `knows` and an edge note declares a `knows` edge without it
- **THEN** the missing-edge-property finding has the edge note's path
