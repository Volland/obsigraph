## ADDED Requirements

### Requirement: Link resolution outside Obsidian
Outside Obsidian (sidecar, CLI, VS Code), the system SHALL resolve a link with Obsidian-compatible rules: an exact vault path first, otherwise a path whose suffix matches, preferring a match in the source note's folder and then the shortest path.

#### Scenario: Same folder preferred
- **WHEN** `People/Alice.md` links `[[Bob]]` and both `People/Bob.md` and `Archive/Old/Bob.md` exist
- **THEN** the edge targets `People/Bob.md`

### Requirement: Duplicate pinned edge ids
The system SHALL keep the first edge that pins a given id, SHALL leave any later edge with the same id out of the graph, and SHALL report a duplicate edge id diagnostic at that later edge's line.

#### Scenario: Same id pinned twice
- **WHEN** two edge lines both carry `{id: "e1"}`
- **THEN** the graph holds only the first as `e1` and a duplicate edge id diagnostic points at the second line
