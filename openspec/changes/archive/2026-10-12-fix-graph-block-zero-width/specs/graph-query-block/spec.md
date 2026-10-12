## ADDED Requirements

### Requirement: Render after layout
The system SHALL start rendering a block only after its container has been attached and sized, SHALL NOT run a layout on the renderer's empty initial graph, and SHALL cancel a pending first render when the block unloads.

#### Scenario: Graph block in a fresh note
- **WHEN** a note containing a `graph-query` block with `view: graph` is opened
- **THEN** the block shows its graph instead of a render error, even though the container had no width when the block loaded

#### Scenario: Unloaded before first frame
- **WHEN** a block unloads before its first render has run
- **THEN** no renderer is created for it
