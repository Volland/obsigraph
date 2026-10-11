## ADDED Requirements

### Requirement: Edge note neighborhood
The system SHALL, when asked for the neighborhood of an edge note's path, return the edge it declares and both endpoint nodes, so opening an edge note shows it as an edge.

#### Scenario: Active edge note
- **WHEN** the graph view focuses `Alice knows Bob.md`, an edge note from Alice to Bob
- **THEN** it shows nodes `Alice.md` and `Bob.md` and the `knows` edge between them
