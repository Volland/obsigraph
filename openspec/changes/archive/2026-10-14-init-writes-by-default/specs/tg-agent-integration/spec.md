## MODIFIED Requirements

### Requirement: Safe init
`tg init` SHALL set up the directory it is given, or the working directory, and never a parent project found above it. It SHALL write the files it plans unless `--dry-run` is given, in which case it SHALL print a diff of every file it would create or change and modify none. `--write` SHALL be accepted and change nothing. Re-running `tg init` SHALL change only what is out of date.

#### Scenario: Dry run
- **WHEN** `tg init --dry-run` runs
- **THEN** a diff is printed and no file is modified

#### Scenario: Writes by default
- **WHEN** `tg init` runs without a terminal in a new project
- **THEN** the planned files are written and listed

#### Scenario: Own folder, not a parent
- **WHEN** `tg init` runs in `~/work/app/` and `~/work/` holds a docs folder
- **THEN** the files are written under `~/work/app/` and nothing under `~/work/` changes

#### Scenario: Idempotent write
- **WHEN** `tg init` runs twice
- **THEN** the second run changes nothing

### Requirement: Interactive setup
`tg init` SHALL treat a run as interactive when it has a terminal on standard input and output and neither `--json` nor `--yes` is given. An interactive run SHALL show its checklists, then write the files and list each one as created or updated, without a further question, and write nothing when every agent or every part is left unticked; with `--dry-run` it SHALL print the diff instead. A non-interactive run SHALL never prompt.

#### Scenario: Confirmed
- **WHEN** an interactive `tg init` finishes its checklists with at least one agent and one part ticked
- **THEN** the files are written and each is listed as created or updated

#### Scenario: Declined
- **WHEN** the person leaves every agent or every part unticked
- **THEN** nothing is written

#### Scenario: Dry run in a terminal
- **WHEN** an interactive `tg init --dry-run` finishes its checklists
- **THEN** a diff is printed and no file is written

### Requirement: Migration from lat
The system SHALL detect an existing lat.md instruction block and, only with `--migrate`, replace it with a tg block that uses `tg` command names.

#### Scenario: Existing block detected
- **WHEN** `CLAUDE.md` contains a `lat:begin` block
- **THEN** `tg init` reports it and states how to migrate

#### Scenario: Migration applied
- **WHEN** `tg init --migrate` runs
- **THEN** the lat block is replaced by a tg block and text outside the markers is untouched

### Requirement: Agent selection
`tg init` SHALL set up one or more coding agents chosen from `claude`, `codex`, `cursor`, `github-copilot`, `opencode`, `kilocode`, `pi`, `oh-my-pi` and `agents`, given as a comma-separated `--agent` list, and SHALL exit with an error for an unknown id. Without `--agent`, in an interactive setup it SHALL show a checklist of every agent with the detected ones ticked. Otherwise it SHALL use the detected agents, or `claude` when none is detected.

#### Scenario: Several agents
- **WHEN** `tg init --agent claude,codex --write` runs
- **THEN** both Claude Code and Codex are set up

#### Scenario: Checklist in a terminal
- **WHEN** `tg init` runs in a terminal without `--agent` in a project with a `.cursor` folder
- **THEN** it shows the agents with Cursor ticked and sets up the agents left ticked

#### Scenario: No terminal
- **WHEN** `tg init --json` runs without `--agent` in a project with no agent files
- **THEN** it asks nothing and sets up Claude Code

#### Scenario: Unknown agent
- **WHEN** `tg init --agent vim` runs
- **THEN** it exits with an error naming the accepted ids and writes nothing

### Requirement: Agent detection
`tg init` SHALL detect an agent as in use when its own folder or instruction file exists or when OpenSpec skills exist in its skills folder: `.claude` or `CLAUDE.md` for Claude Code, `.codex` for Codex, `.cursor` for Cursor, `.github/skills` or `.github/copilot-instructions.md` for GitHub Copilot, `.opencode` for OpenCode, `.kilocode` for Kilo Code, `.pi` for Pi, `.omp` for Oh My Pi, and `.agents` or `AGENTS.md` for generic agents.

#### Scenario: OpenSpec set up Codex
- **WHEN** `.agents/skills/openspec-propose/SKILL.md` exists and `tg init --json` runs without `--agent`
- **THEN** generic agents are detected and the tg skills are planned under `.agents/skills/`

#### Scenario: Pi detected
- **WHEN** a project has a `.pi` folder and `tg init --json` runs without `--agent`
- **THEN** Pi is detected and the tg skills are planned under `.pi/skills/`

### Requirement: Skills per agent
`tg init --write` SHALL install every bundled skill as `<skills folder>/<name>/SKILL.md` for each selected agent, where the skills folder is `.claude/skills` for Claude Code, `.agents/skills` for Codex and generic agents, `.cursor/skills` for Cursor, `.github/skills` for GitHub Copilot and `.opencode/skills` for OpenCode, `.kilocode/skills` for Kilo Code, `.pi/skills` for Pi, `.omp/skills` for Oh My Pi, writing a folder shared by two agents once.

#### Scenario: Codex skills
- **WHEN** `tg init --agent codex --write` runs
- **THEN** the five tg skills exist under `.agents/skills/` and `AGENTS.md` holds the tg block

#### Scenario: Kilo Code and Oh My Pi skills
- **WHEN** `tg init --agent kilocode,oh-my-pi` runs
- **THEN** the five tg skills exist under `.kilocode/skills/` and `.omp/skills/` and `AGENTS.md` holds the tg block
