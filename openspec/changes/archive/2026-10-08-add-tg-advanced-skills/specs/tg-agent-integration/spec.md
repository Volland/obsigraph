## MODIFIED Requirements

### Requirement: Bundled skills
The system SHALL ship the skills `tg-docs` (docs maintenance), `tg-graph` (graph queries), `tg-trace` (OpenSpec traceability), `tg-impact` (change impact) and `tg-audit` (spec audit) and install all of them under `.claude/skills/` with `tg init --write` for Claude Code.

#### Scenario: Skills installed
- **WHEN** `tg init --write` runs for Claude Code
- **THEN** all five skills exist under the project's skills directory

## ADDED Requirements

### Requirement: OpenSpec skill patching
When OpenSpec skills or commands for Claude Code exist, `tg init` SHALL append to each propose, apply, archive and explore skill or command a block bounded by `<!-- tg:begin -->` and `<!-- tg:end -->` with the `tg` steps for that stage, SHALL replace only that block on later runs, SHALL leave every other OpenSpec file and all text outside the block unchanged, and SHALL skip patching with `--no-openspec`.

#### Scenario: Skills patched
- **WHEN** `.claude/skills/openspec-apply-change/SKILL.md` and `.claude/commands/opsx/apply.md` exist and `tg init --write` runs
- **THEN** both end with a tg block that tells the agent to annotate code with `implements` and tests with `verifies`, and their original text is unchanged

#### Scenario: Re-run is stable
- **WHEN** `tg init --write` runs a second time
- **THEN** each patched file still holds exactly one tg block and no change is reported

#### Scenario: Regenerated skill
- **WHEN** OpenSpec regenerates a patched skill without the block and `tg init --write` runs again
- **THEN** the block is appended again

#### Scenario: Opt out
- **WHEN** `tg init --write --no-openspec` runs
- **THEN** no OpenSpec file changes

### Requirement: Skills-only init
`tg init --skills-only` SHALL write only the bundled skills and the OpenSpec patches, leaving instruction files, hooks, MCP configuration, `lat.md/` and the ontology untouched.

#### Scenario: Existing lat.md project
- **WHEN** a project with a lat.md instruction block runs `tg init --skills-only --write`
- **THEN** only files under `.claude/skills/` and `.claude/commands/` change

### Requirement: Skill text available
`tg gen` SHALL print every bundled skill and every OpenSpec patch block by name.

#### Scenario: Print a patch
- **WHEN** `tg gen openspec-apply.md` runs
- **THEN** it prints the block that `tg init` appends to the apply skill
