## ADDED Requirements

### Requirement: Frontmatter link edges
The system SHALL, when the frontmatter edges option is on, turn each wikilink or markdown link in a frontmatter property value, or in a list of values, into an edge from the note to the link target, typed by the property name, with sign +1, no properties and no source heading. It SHALL ignore values without links, empty `[[]]` placeholders and the properties `tags`, `aliases`, `cssclasses`, `type` and `types`. The option SHALL be off by default. These edges SHALL be added to the edges written in the note body, SHALL follow edits to the note, and SHALL be checked by schema edge declarations like any other edge.

#### Scenario: Single and list values
- **WHEN** the option is on and a note has `requirement: "[[Login]]"` and `topics: ["[[Security]]", "[[Auth]]"]`
- **THEN** the note has one `requirement` edge to `Login` and two `topics` edges, to `Security` and to `Auth`

#### Scenario: Alias, subpath and markdown links
- **WHEN** a property value is `[[Security|sec]]`, `[[Auth#Flow]]` or `[Docs](docs/Guide.md)`
- **THEN** the edges record alias `sec`, subpath `Flow` and the vault path of `docs/Guide.md` respectively

#### Scenario: Values without links and skipped properties
- **WHEN** a note has `owner: bob`, `estimate: 3`, `feature: "[[]]"`, `tags: ["[[x]]"]` and `type: "[[Task]]"`
- **THEN** it has no frontmatter edges

#### Scenario: Off by default
- **WHEN** the option is not set and a note has `requirement: "[[Login]]"`
- **THEN** the graph has no `requirement` edge

#### Scenario: Alongside body edges
- **WHEN** a note has `related: "[[A]]"` in frontmatter and `related:: [[A]]` in its body
- **THEN** the graph has both edges, with distinct IDs

#### Scenario: Follows note edits
- **WHEN** a note's `requirement` property changes from `[[Ghost]]` to `[[Other]]`, or is removed
- **THEN** the edge to `Ghost` is replaced by an edge to `Other`, or removed, and the `Ghost` stub disappears

#### Scenario: Schema checks apply
- **WHEN** the option is on, `requirement` is declared as an edge type from `Task` to `Requirement`, and a Task's `requirement` property links to a Bug
- **THEN** validation reports a wrong-target-type finding at that note, and reports none when the option is off
