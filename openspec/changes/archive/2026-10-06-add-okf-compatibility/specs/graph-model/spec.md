## ADDED Requirements

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
