# graph-model Specification

## Purpose
Defines the in-memory property graph derived from the vault: how notes become labeled nodes, how links become identified edges, and how the graph stays current as notes change.

## Requirements

### Requirement: One note is one node
The system SHALL create exactly one node per markdown note, and SHALL NOT create nodes for headings or blocks.

#### Scenario: Note with headings
- **WHEN** a note has three headings and two edges
- **THEN** the graph contains one node for that note

### Requirement: Stub nodes for unresolved links
The system SHALL create a stub node for each edge target that does not match an existing note, marked as a stub, so no edge is left without a target.

#### Scenario: Link to missing note
- **WHEN** a note has `knows:: [[Nobody]]` and no note named `Nobody` exists
- **THEN** a stub node `Nobody` exists and the edge points to it

#### Scenario: Stub becomes real
- **WHEN** a note named `Nobody` is later created
- **THEN** the stub is replaced by the real node and existing edges keep pointing to it

### Requirement: Node labels from frontmatter
The system SHALL derive a node's labels from its frontmatter `type` value, accepting a string or a list, so a list yields multiple labels. A node without `type` SHALL have no type label.

#### Scenario: Multiple types
- **WHEN** a note has frontmatter `type: [Person, Employee]`
- **THEN** the node has labels `Person` and `Employee`

### Requirement: Node properties
The system SHALL expose a note's frontmatter fields, its file path and its title as node properties.

#### Scenario: Frontmatter property
- **WHEN** a note has frontmatter `age: 31`
- **THEN** the node has property `age` = 31

### Requirement: Derived edge IDs
The system SHALL give each edge the ID `source#type#target#n`, where `n` is its zero-based ordinal among edges sharing the same source, type and target, and SHALL use an explicit `id` property instead when one is present.

#### Scenario: Duplicate edges
- **WHEN** a note has two `knows:: [[Bob]]` lines
- **THEN** their IDs differ only in the ordinal `n`

#### Scenario: Pinned ID
- **WHEN** an edge has `{id: "met-2020"}`
- **THEN** its ID is `met-2020`

### Requirement: Incremental updates
The system SHALL update the graph when a note is created, modified, renamed or deleted, touching only that note's contributions and the affected stubs.

#### Scenario: Note edited
- **WHEN** a note's edge line is changed
- **THEN** the old edge disappears and the new edge appears without rebuilding the whole graph

#### Scenario: Note deleted
- **WHEN** a note that other notes link to is deleted
- **THEN** edges pointing to it now point to a stub node

### Requirement: Plain link edges
The system SHALL, when built with the link-edges option, turn every plain wikilink or markdown link to a note outside edge lines, code and frontmatter into an untyped edge of type `links_to` with sign +1, and SHALL NOT do so when the option is off.

#### Scenario: OKF prose link
- **WHEN** link edges are on and a note says `See the [customers table](/tables/customers.md).`
- **THEN** the graph has a `links_to` edge from the note to `tables/customers.md`

#### Scenario: Option off
- **WHEN** link edges are off
- **THEN** prose links produce no edges, as before

#### Scenario: Images ignored
- **WHEN** a note contains `![diagram](/img/a.png)` or `![[a.png]]`
- **THEN** no edge is produced

### Requirement: Frontmatter title
The system SHALL use a non-empty string frontmatter `title` as the node's `title` property, and the file name otherwise, and SHALL add the entries of a frontmatter `types` list to the node's labels after those from `type`.

#### Scenario: OKF title
- **WHEN** a note has frontmatter `title: GA4 Events Export`
- **THEN** the node's `title` is `GA4 Events Export`

#### Scenario: Types list
- **WHEN** a note has `type: Person` and `types: [Person, Engineer]`
- **THEN** the node has labels `Person` and `Engineer`

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
