## ADDED Requirements

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
