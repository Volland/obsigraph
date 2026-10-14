# tg-agent-integration Specification

## Purpose
Defines how `tg` plugs into coding agents: setup, instruction generation, hooks, an MCP server and skills, without silently editing user files.

## Requirements

### Requirement: Safe init
The system SHALL print a diff of every file a non-interactive `tg init` would create or change and SHALL apply changes only when `--write` is given or, in an interactive run, when the person confirms.

#### Scenario: Dry run
- **WHEN** `tg init` runs without `--write` and without a terminal
- **THEN** a diff is printed and no file is modified

#### Scenario: Idempotent write
- **WHEN** `tg init --write` runs twice
- **THEN** the second run changes nothing

### Requirement: Migration from lat
The system SHALL detect an existing lat.md instruction block and, only with `--write --migrate`, replace it with a tg block that uses `tg` command names.

#### Scenario: Existing block detected
- **WHEN** `CLAUDE.md` contains a `lat:begin` block
- **THEN** `tg init` reports it and states how to migrate

#### Scenario: Migration applied
- **WHEN** `tg init --write --migrate` runs
- **THEN** the lat block is replaced by a tg block and text outside the markers is untouched

### Requirement: Instruction generation
The system SHALL print agent instruction text for `agents.md`, `claude.md` and `cursor-rules.md` with `tg gen`.

#### Scenario: Generate
- **WHEN** `tg gen claude.md` runs
- **THEN** it prints instructions telling the agent to run `tg search` before work and `tg check` after

### Requirement: Agent hooks
The system SHALL handle agent hook events through `tg hook` and SHALL exit 0 even when an internal error occurs, printing a note instead. `tg init` SHALL install hooks for Claude Code only; for Cursor it SHALL write rules and skills, and `tg hook cursor stop` SHALL stay available for users who add it to their Cursor hook configuration themselves.

#### Scenario: Prompt hook
- **WHEN** a prompt-submit event arrives
- **THEN** the hook output tells the agent to search first and expands any `[[refs]]` in the prompt

#### Scenario: Internal failure
- **WHEN** the project cannot be read
- **THEN** the hook exits 0 with a note and does not block the agent

#### Scenario: Cursor init
- **WHEN** `tg init --agent cursor --write` runs
- **THEN** `.cursor/rules/tg.mdc` and the tg skills under `.cursor/skills/` are written and no Cursor hook configuration is created

### Requirement: MCP server
The system SHALL serve the tools `tg_locate`, `tg_section`, `tg_refs`, `tg_search`, `tg_expand`, `tg_check`, `tg_cypher` and `tg_edges` over stdio MCP with `tg mcp`, each marked read-only and sharing its implementation with the CLI command of the same name, and SHALL report the server name `tg` and the installed CLI version. Tools added by other capabilities, such as `tg_trace`, SHALL follow the same `tg_` naming.

#### Scenario: Cypher over docs and code
- **WHEN** an agent calls `tg_cypher` with a query over `Section` and `CodeSymbol` nodes
- **THEN** it receives the same `_type`-tagged result contract as the sidecar

#### Scenario: Tool names
- **WHEN** an MCP client lists the tools of `tg mcp`
- **THEN** every tool name starts with `tg_` and the list includes `tg_locate`, `tg_section`, `tg_refs`, `tg_search`, `tg_expand`, `tg_check`, `tg_cypher` and `tg_edges`

### Requirement: Bundled skills
The system SHALL ship the skills `tg-docs` (docs maintenance), `tg-graph` (graph queries), `tg-trace` (OpenSpec traceability), `tg-impact` (change impact) and `tg-audit` (spec audit) and install all of them with `tg init --write` into the skills folder of every selected agent.

#### Scenario: Skills installed
- **WHEN** `tg init --write` runs for Claude Code
- **THEN** all five skills exist under the project's skills directory

### Requirement: Code ontology install
`tg init --write` SHALL install the code ontology guide `lat.md/code-ontology.md`, its schema `Types/code-types.md` and one template note per type under `Templates/`, each only when absent, SHALL link each type to its template, SHALL list the guide in the `lat.md` index so `tg check` stays clean, SHALL note an `ontology/code-types.md` left by an older version, and SHALL skip all of them when the `ontology` part is not selected.

#### Scenario: Types and templates
- **WHEN** `tg init --write` runs in a new project
- **THEN** `Types/code-types.md` declares Decision with `template: "[[Templates/Decision]]"` and `Templates/Decision.md` exists

#### Scenario: Existing ontology kept
- **WHEN** `lat.md/code-ontology.md` exists with local edits and `tg init --write` runs
- **THEN** the file is unchanged

#### Scenario: Opt out
- **WHEN** `tg init --write --no-ontology` runs in a new project
- **THEN** neither `lat.md/code-ontology.md`, `Types/` nor `Templates/` is created

### Requirement: Claude Code registration
For Claude Code, `tg init --write` SHALL register `tg hook claude UserPromptSubmit` and `tg hook claude Stop` in `.claude/settings.json` and an MCP server `tg` (`tg mcp`) in `.mcp.json`, preserving every other setting, hook and server, and with `--migrate` SHALL remove the `lat` MCP server.

#### Scenario: Other servers kept
- **WHEN** `.mcp.json` already defines a server `github` and `tg init --write` runs
- **THEN** `.mcp.json` defines both `github` and `tg`

### Requirement: Prompt hook stays offline
The prompt-submit hook SHALL search the project lexically only and SHALL NOT call an embedding provider or any other network service, even when one is configured.

#### Scenario: Provider configured
- **WHEN** `TG_EMBED_PROVIDER=openai` is set and a prompt-submit event arrives
- **THEN** the hook output includes lexical search hits and no network request is made

### Requirement: OpenSpec skill patching
When OpenSpec skills exist in a selected agent's skills folder, or OpenSpec commands for Claude Code exist, `tg init` SHALL append to each propose, apply, archive and explore skill or command a block bounded by `<!-- tg:begin -->` and `<!-- tg:end -->` with the `tg` steps for that stage, SHALL replace only that block on later runs, SHALL leave every other OpenSpec file and all text outside the block unchanged, and SHALL skip patching with `--no-openspec`.

#### Scenario: Skills patched
- **WHEN** `.claude/skills/openspec-apply-change/SKILL.md` and `.claude/commands/opsx/apply.md` exist and `tg init --write` runs
- **THEN** both end with a tg block that tells the agent to annotate code with `implements` and tests with `verifies`, and their original text is unchanged

#### Scenario: Other agent's OpenSpec skill
- **WHEN** `.cursor/skills/openspec-apply-change/SKILL.md` exists and `tg init --agent cursor --write` runs
- **THEN** that skill ends with the tg block

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
`tg init --skills-only` SHALL set up only the `skills` and `openspec` parts for the selected agents, leaving instruction files, hooks, MCP configuration, `lat.md/` and the ontology untouched.

#### Scenario: Existing lat.md project
- **WHEN** a project with a lat.md instruction block runs `tg init --skills-only --write`
- **THEN** only files under `.claude/skills/` and `.claude/commands/` change

### Requirement: Skill text available
`tg gen` SHALL print every bundled skill and every OpenSpec patch block by name.

#### Scenario: Print a patch
- **WHEN** `tg gen openspec-apply.md` runs
- **THEN** it prints the block that `tg init` appends to the apply skill

### Requirement: Agent selection
`tg init` SHALL set up one or more coding agents chosen from `claude`, `codex`, `cursor`, `github-copilot`, `opencode` and `agents`, given as a comma-separated `--agent` list, and SHALL exit with an error for an unknown id. Without `--agent`, in an interactive setup it SHALL show a checklist of every agent with the detected ones ticked. Otherwise it SHALL use the detected agents, or `claude` when none is detected.

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

### Requirement: Setup parts
`tg init` SHALL set up any of five parts: `instructions` (the tg block in `CLAUDE.md` or `AGENTS.md`, or Cursor's rules file), `hooks` (Claude Code hooks and the `tg` MCP server), `skills`, `openspec` (OpenSpec skill patches and config rules) and `ontology`. `--only` and `--skip` SHALL take comma-separated part names, `--no-ontology` and `--no-openspec` SHALL skip those parts and `--skills-only` SHALL mean `skills` and `openspec`. Without any of these flags, in an interactive setup it SHALL show a checklist of the parts with all ticked except `openspec` when the project has no `openspec/` folder. Otherwise every part SHALL be set up. An unknown part name SHALL be an error.

#### Scenario: Only the OpenSpec config
- **WHEN** a project has `openspec/config.yaml` and `tg init --only openspec --write` runs
- **THEN** only OpenSpec files change and `CLAUDE.md` and `AGENTS.md` are not created

#### Scenario: Skip instructions
- **WHEN** `tg init --skip instructions --write` runs
- **THEN** no `CLAUDE.md` or `AGENTS.md` is created and the skills are installed

### Requirement: Interactive setup
`tg init` SHALL treat a run as interactive when it has a terminal on standard input and output and neither `--json` nor `--yes` is given. An interactive run SHALL list the files it will create or update and, without `--write`, SHALL ask for confirmation and write them only when the answer is empty or yes. A non-interactive run SHALL never prompt.

#### Scenario: Confirmed
- **WHEN** an interactive `tg init` is confirmed with an empty answer
- **THEN** the listed files are written

#### Scenario: Declined
- **WHEN** an interactive `tg init` is answered with `n`
- **THEN** no file is written

### Requirement: Agent detection
`tg init` SHALL detect an agent as in use when its own folder or instruction file exists or when OpenSpec skills exist in its skills folder: `.claude` or `CLAUDE.md` for Claude Code, `.codex` for Codex, `.cursor` for Cursor, `.github/skills` or `.github/copilot-instructions.md` for GitHub Copilot, `.opencode` for OpenCode, and `.agents` or `AGENTS.md` for generic agents.

#### Scenario: OpenSpec set up Codex
- **WHEN** `.agents/skills/openspec-propose/SKILL.md` exists and `tg init --json` runs without `--agent`
- **THEN** generic agents are detected and the tg skills are planned under `.agents/skills/`

### Requirement: Skills per agent
`tg init --write` SHALL install every bundled skill as `<skills folder>/<name>/SKILL.md` for each selected agent, where the skills folder is `.claude/skills` for Claude Code, `.agents/skills` for Codex and generic agents, `.cursor/skills` for Cursor, `.github/skills` for GitHub Copilot and `.opencode/skills` for OpenCode, writing a folder shared by two agents once.

#### Scenario: Codex skills
- **WHEN** `tg init --agent codex --write` runs
- **THEN** the five tg skills exist under `.agents/skills/` and `AGENTS.md` holds the tg block

### Requirement: OpenSpec config rules
When `openspec/config.yaml` exists, `tg init` SHALL add tg rules to its `rules` mapping for the `proposal`, `specs`, `design` and `tasks` artifacts, each rule starting with `tg:`, SHALL on later runs replace only rules starting with `tg:`, SHALL keep every other rule, key and comment, SHALL NOT create the file when it is absent, and SHALL skip it with `--no-openspec`. The rules SHALL teach OpenSpec to annotate what it generates: `specs` rules keep requirement and scenario names citable, and `tasks` rules ask for an `implements` annotation on the code of each requirement, a `verifies` annotation on the test of each scenario, the capability in the `openspec:` frontmatter of the lat.md file that explains it, and a final `tg check` and `tg trace` step.

#### Scenario: Rules added
- **WHEN** `openspec/config.yaml` holds `schema: spec-driven`, a comment and a `tasks` rule of the project, and `tg init --write` runs
- **THEN** the file keeps the schema, the comment and the project's rule and gains `tg:` rules for proposal, specs, design and tasks

#### Scenario: Re-run is stable
- **WHEN** `tg init --write` runs a second time
- **THEN** `openspec/config.yaml` is unchanged

#### Scenario: No OpenSpec
- **WHEN** a project has no `openspec/config.yaml` and `tg init --write` runs
- **THEN** no `openspec/` file is created

### Requirement: Docs folder choice
`tg init` SHALL use the project's existing docs folder, `lat.md/` before `tg.md/`. When neither exists it SHALL create the folder named by `--docs lat.md` or `--docs tg.md`, else in an interactive setup ask which of the two to create, describing `lat.md/` as compatible with the `lat` command, else create `lat.md/`. When `--docs` names the other folder than an existing one, the existing folder SHALL be used and a note SHALL say so. The index, ontology guide, agent instructions, skills and hook messages it installs SHALL name the folder in use. An unknown `--docs` value SHALL be an error.

#### Scenario: Asked in a terminal
- **WHEN** an interactive `tg init` runs in a project with neither folder and the person picks `tg.md`
- **THEN** `tg.md/tg.md` is created and `CLAUDE.md` tells the agent to keep `tg.md/` in sync

#### Scenario: Flag for scripts
- **WHEN** `tg init --docs tg.md --write` runs in a project with neither folder
- **THEN** `tg.md/tg.md` and `tg.md/code-ontology.md` are created and no `lat.md/` exists

#### Scenario: Existing lat.md kept
- **WHEN** `tg init --docs tg.md --write` runs in a project that has `lat.md/`
- **THEN** no `tg.md/` is created, the instructions name `lat.md/`, and a note says `lat.md/` is used

#### Scenario: Default without a terminal
- **WHEN** `tg init --json` runs in a project with neither folder
- **THEN** it plans `lat.md/lat.md` and asks nothing
