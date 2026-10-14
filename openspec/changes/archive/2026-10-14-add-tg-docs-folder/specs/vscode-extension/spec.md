## MODIFIED Requirements

### Requirement: Set up TypeGraph
When the workspace has neither a `lat.md/` nor a `tg.md/` folder, or none of `CLAUDE.md` and `AGENTS.md` contains a `%% tg:begin %%` block and `.cursor/rules/tg.mdc` does not exist, the extension SHALL offer a "Set up TypeGraph" action in the TypeGraph sidebar view and the command palette that shows the files `tg init --write` will create or change, asks for confirmation, then runs `tg init --write` in a visible VS Code terminal, preferring a global `tg` and falling back to `npx @typedgraph/cli init --write`.

#### Scenario: Confirmation first
- **WHEN** the user selects the action
- **THEN** a confirmation lists the files before any command runs, and declining runs nothing

#### Scenario: Global tg preferred
- **WHEN** `tg` is on the PATH
- **THEN** the terminal runs `tg init --write`, otherwise `npx @typedgraph/cli init --write`

#### Scenario: Value first
- **WHEN** the workspace has neither `lat.md/` nor `tg.md/`
- **THEN** backlinks for markdown files still work and the setup offer is shown without blocking them

#### Scenario: tg.md counts as set up
- **WHEN** the workspace has `tg.md/` and `CLAUDE.md` holds a `%% tg:begin %%` block
- **THEN** no setup offer is shown
