## MODIFIED Requirements

### Requirement: Full Cypher for reads
The system SHALL pass read queries that the in-plugin engine cannot run, whether it reports them as unsupported or cannot parse them, to LadybugDB untranslated after the read-only guard, so that read-only Cypher the installed LadybugDB supports can be used. An untranslated query SHALL be written against the mirror layout. The system SHALL refuse `CALL`, `LOAD` and `USE` and the functions `startNode`, `endNode`, `keys` and `properties` on this backend, naming the construct.

#### Scenario: Clause unsupported in-plugin
- **WHEN** a query uses a read clause the in-plugin engine does not support and the Ladybug backend is selected
- **THEN** the query runs and returns a result

#### Scenario: Procedure call refused
- **WHEN** a query on the Ladybug backend uses `CALL`
- **THEN** it is refused with an error naming `CALL` and nothing runs on the database

### Requirement: Errors reported with position
The system SHALL report Ladybug syntax and runtime errors in the block with the first line of the database message prefixed `Ladybug: ` and, where the database gives one, line and column; a syntax error in text the in-plugin parser reads MAY come from the in-plugin parser instead. A query that exceeds the sidecar's timeout SHALL fail with error kind `timeout` (HTTP 504).

#### Scenario: Syntax error
- **WHEN** a Ladybug query is `MATCH (a RETURN a`
- **THEN** the block shows a syntax error message

#### Scenario: Runtime error from the database
- **WHEN** a pass-through query fails inside LadybugDB
- **THEN** the block shows the database message prefixed `Ladybug: `

## ADDED Requirements

### Requirement: Untranslated queries are flagged
A query passed to LadybugDB untranslated SHALL carry a notice saying it ran against the mirror layout, which the block shows with the result.

#### Scenario: Pass-through notice
- **WHEN** a query that uses `UNWIND` runs on the Ladybug backend
- **THEN** the result carries a notice that the query ran untranslated against the mirror layout

### Requirement: Rejected token explained
When the sidecar rejects the configured token (HTTP 401), the block SHALL say the sidecar token was rejected and where to set it, and SHALL NOT fall back to the built-in engine.

#### Scenario: Wrong token
- **WHEN** a Ladybug block runs with a token the sidecar does not accept
- **THEN** the block says the token was rejected and points to the sidecar token setting
