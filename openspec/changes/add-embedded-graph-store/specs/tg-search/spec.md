## MODIFIED Requirements

### Requirement: Derived cache
The system SHALL keep search state only in a rebuildable graph store at `.tg/graph.lbug`, SHALL rebuild it with `tg reindex`, and SHALL delete the former `.tg/vectors.json` and `.tg/vectors.f32` files when it first creates the store.

#### Scenario: Cache deleted
- **WHEN** `.tg/` is removed
- **THEN** the next search works and recreates it

#### Scenario: Old cache files removed
- **WHEN** a project still has `.tg/vectors.json` and `.tg/vectors.f32` and `tg search` runs
- **THEN** the files are deleted and `.tg/graph.lbug` is created
