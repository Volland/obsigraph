# visualization-config Specification

## Purpose
Defines per-type and per-edge-type visual attributes, where each can be declared, and the single precedence rule that decides which declaration wins, so graphs look the same in blocks and in the Graph view unless deliberately overridden.

## Requirements

### Requirement: Precedence of style sources
The system SHALL resolve each visual attribute independently using, from highest to lowest priority, the `graph-query` block header, the schema note of the type, the plugin settings default for the type, and the built-in default.

#### Scenario: Block header beats schema note
- **WHEN** the schema note for `Person` sets color `blue` and a block header sets the color for `Person` to `red`
- **THEN** `Person` nodes in that block are red and in other blocks are blue

#### Scenario: Schema note beats settings
- **WHEN** the plugin settings set color `green` for `Person` and the schema note sets `blue`
- **THEN** `Person` nodes are blue

#### Scenario: Attributes fall through independently
- **WHEN** the schema note sets only a shape for `Person` and the settings set only a color
- **THEN** `Person` nodes use the schema shape and the settings color

### Requirement: Schema visualization block
The system SHALL read color, shape, icon and label property for a node type from the `visualization` section of its schema note.

#### Scenario: Declared visualization applied
- **WHEN** `Types/Person.md` declares color `#3b82f6`, shape `ellipse` and icon `user`
- **THEN** Person nodes in any graph render with those attributes

#### Scenario: Label property
- **WHEN** the schema declares label property `name` and a node has `name: Alice`
- **THEN** the node is labeled `Alice` instead of the note title

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

### Requirement: Block header style entries
The system SHALL accept style entries in a `graph-query` block header scoped to a node type or an edge type, and SHALL apply them only to that block.

#### Scenario: Header style scoped to one block
- **WHEN** a header declares shape `diamond` for type `Project`
- **THEN** Project nodes in that block are diamonds and Project nodes elsewhere are unchanged

### Requirement: Invalid style values are ignored visibly
The system SHALL ignore an invalid style value, fall back to the next source in the precedence order and report a diagnostic naming the source and attribute.

#### Scenario: Bad color in schema note
- **WHEN** a schema note sets color `not-a-color` and settings set `green`
- **THEN** nodes use `green` and a diagnostic names the schema note and `color`

### Requirement: Multi-label nodes
The system SHALL style a node with several labels using the first label, in label order, that supplies a value for each attribute.

#### Scenario: Second label supplies shape
- **WHEN** a node has labels `Person` and `Employee`, only `Employee` defines a shape
- **THEN** the node uses the `Employee` shape and the `Person` color if one is defined

### Requirement: Live style updates
The system SHALL re-style rendered graphs when a schema note or setting changes, in the same vault index update that processes the change, without losing layout positions.

#### Scenario: Color edit refreshes open graphs
- **WHEN** the user changes the color in `Types/Person.md`
- **THEN** after the index processes that change, open blocks and the Graph view show the new color with nodes in the same positions

### Requirement: Built-in style defaults
Without any configured style, the system SHALL give a node a stable color derived from its first type label and the ellipse shape, SHALL draw unlabeled nodes grey, and SHALL draw stub nodes faded and dashed.

#### Scenario: Stable color per type
- **WHEN** two vaults with no style configuration both contain `Person` notes
- **THEN** Person nodes get the same color in both
