## MODIFIED Requirements

### Requirement: Edge type styling
The system SHALL allow color and line style per edge type from schema notes and settings, and SHALL render negative-sign edges visibly distinct from positive ones: a negative edge SHALL always have a tee arrow and a minus-prefixed label, and SHALL be dashed unless a style source sets its line. In schema notes an edge type MAY be styled by the `visualization` of its `edgeTypes` entry or by a node type's `visualization.edges` map; both are at the schema-note level, and the `edgeTypes` entry wins per attribute when both set it.

#### Scenario: Edge type color
- **WHEN** a schema declares color `orange` for edge type `knows`
- **THEN** `knows` edges render orange

#### Scenario: Edge type entry styles edges
- **WHEN** `edgeTypes: {worksAt: {visualization: {color: green, line: dashed}}}` is declared
- **THEN** `worksAt` edges render green and dashed

#### Scenario: Sign rendering default
- **WHEN** an edge with sign -1 has no explicit style for its type
- **THEN** it renders with the distinct negative style

#### Scenario: Line override keeps the negative marks
- **WHEN** edge type `knows` is styled `line: solid` and an edge `-knows:: [[Bob]]` is drawn
- **THEN** the edge is solid and still has a tee arrow and a minus-prefixed label

### Requirement: Live style updates
The system SHALL re-style rendered graphs when a schema note or setting changes, in the same vault index update that processes the change, without losing layout positions.

#### Scenario: Color edit refreshes open graphs
- **WHEN** the user changes the color in `Types/Person.md`
- **THEN** after the index processes that change, open blocks and the Graph view show the new color with nodes in the same positions

## ADDED Requirements

### Requirement: Built-in style defaults
Without any configured style, the system SHALL give a node a stable color derived from its first type label and the ellipse shape, SHALL draw unlabeled nodes grey, and SHALL draw stub nodes faded and dashed.

#### Scenario: Stable color per type
- **WHEN** two vaults with no style configuration both contain `Person` notes
- **THEN** Person nodes get the same color in both
