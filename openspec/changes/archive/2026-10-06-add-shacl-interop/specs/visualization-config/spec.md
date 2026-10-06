## MODIFIED Requirements

### Requirement: Edge type styling
The system SHALL allow color and line style per edge type from schema notes and settings, and SHALL render negative-sign edges visibly distinct from positive ones unless a style explicitly overrides it. In schema notes an edge type MAY be styled by the `visualization` of its `edgeTypes` entry or by a node type's `visualization.edges` map; both are at the schema-note level, and the `edgeTypes` entry wins per attribute when both set it.

#### Scenario: Edge type color
- **WHEN** a schema declares color `orange` for edge type `knows`
- **THEN** `knows` edges render orange

#### Scenario: Edge type entry styles edges
- **WHEN** `edgeTypes: {worksAt: {visualization: {color: green, line: dashed}}}` is declared
- **THEN** `worksAt` edges render green and dashed

#### Scenario: Sign rendering default
- **WHEN** an edge with sign -1 has no explicit style for its type
- **THEN** it renders with the distinct negative style
