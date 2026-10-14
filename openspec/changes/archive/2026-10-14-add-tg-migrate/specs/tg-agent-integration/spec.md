## MODIFIED Requirements

### Requirement: Bundled skills
The system SHALL ship the skills `tg-docs` (docs maintenance), `tg-graph` (graph queries), `tg-trace` (OpenSpec traceability), `tg-impact` (change impact), `tg-audit` (spec audit) and `tg-migrate` (lat.md to typed graph migration) and install all of them with `tg init --write` into the skills folder of every selected agent.

#### Scenario: Skills installed
- **WHEN** `tg init --write` runs for Claude Code
- **THEN** all six skills exist under the project's skills directory
