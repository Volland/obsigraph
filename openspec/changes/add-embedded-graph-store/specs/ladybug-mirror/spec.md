## MODIFIED Requirements

### Requirement: Mirror storage layout
The mirror SHALL store every node in one `Node` table with its labels as a list and each edge type in its own relationship table, with one typed column per property name and value kind named `p_<name>_<kind>`, so pass-through Cypher can be written against a documented layout. The layout SHALL be created from the shared schema module in `core` that every graph store uses, so the mirror and the stores of the plugin and the CLI have the same tables.

#### Scenario: Typed property columns
- **WHEN** `since` holds a number on one `knows` edge and a string on another
- **THEN** the `knows` table stores them in separate number and string columns for `since`

#### Scenario: Same layout as the CLI store
- **WHEN** the sidecar mirrors a vault and the CLI builds a store for the same folder
- **THEN** both have the same tables and columns
