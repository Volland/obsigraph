# example-vault Specification

## Purpose
Keeps the demo vault in `example/`, which doubles as the user manual, honest: every query, embed and deliberate mistake in it behaves as its text says, and each release ships it with the plugin preinstalled.

## Requirements

### Requirement: Every guide query runs
Each `graph-query` block in the example vault outside the diagnostics playground SHALL parse without header errors, SHALL use the built-in engine, SHALL return at least one row and SHALL get a render plan.

#### Scenario: Guide queries checked
- **WHEN** the example vault test runs over every note
- **THEN** each guide query returns rows and a render plan with no header error

### Requirement: Playground queries fail clearly
The broken queries in the diagnostics playground SHALL raise errors, and its write query SHALL be rejected as read-only.

#### Scenario: Write query in the playground
- **WHEN** the playground's write query runs on the built-in engine
- **THEN** it fails with error kind `readonly`

### Requirement: Embeds resolve
Every `{{edge: ...}}` embed outside code in the example vault SHALL resolve to a value or a table, except the one embed the playground deliberately points at a missing edge.

#### Scenario: Only the deliberate miss
- **WHEN** every embed in the vault is resolved
- **THEN** exactly one is unresolved, and it is in the diagnostics playground

### Requirement: Deliberate diagnostics only
Schema validation of the example vault SHALL flag only the deliberate mistakes (Dave missing `role`, Mallory with a disallowed edge), edge syntax diagnostics SHALL come only from the playground, and the stubs SHALL be exactly Eve, Globex and Property Graphs 101.

#### Scenario: Diagnostics listed
- **WHEN** the example vault is indexed
- **THEN** the schema findings name only Dave and Mallory and the stub nodes are Eve, Globex and Property Graphs 101

### Requirement: Ladybug examples run
Every example in the vault whose header selects `backend: ladybug` SHALL run without error and return rows on a sidecar mirror of the vault.

#### Scenario: Pass-through examples match the mirror
- **WHEN** a sidecar with the Ladybug mirror indexes the example vault and each Ladybug example runs
- **THEN** every example returns rows without error

### Requirement: Demo vault shipped with releases
Each release SHALL attach `typed-graph-demo-vault.zip`, the example vault with the freshly built plugin preinstalled in `.obsidian/plugins/typed-graph/`, and `npm run example:install` SHALL install the built plugin into a local copy without committing it.

#### Scenario: Release asset
- **WHEN** a release is published
- **THEN** `typed-graph-demo-vault.zip` is attached and contains `.obsidian/plugins/typed-graph/main.js`
