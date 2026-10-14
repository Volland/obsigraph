## Why

`tg` reads its documentation only from a folder named `lat.md/`, because it started as a drop-in replacement for lat.md. Teams that adopt tg without lat.md find the name confusing: it names another tool, and nothing in their project is called lat. They should be able to keep their docs in `tg.md/`, while projects that already use `lat.md/` keep working untouched and stay compatible with the `lat` command.

## What Changes

- The docs folder is `lat.md/` when it exists, otherwise `tg.md/`. An existing `lat.md/` always wins, so lat.md projects and `lat check` parity are unaffected.
- Project root discovery also stops at a directory holding `tg.md/`.
- Every lattice command (`check`, `search`, `section`, `locate`, `refs`, `expand`, `cypher`, `edges`, `trace`), the hooks and the MCP server use the project's docs folder. Section ids start with the folder name (`tg.md/auth#Auth#Login`), and the root index file is `tg.md/tg.md`, mirroring `lat.md/lat.md`.
- `tg init` uses the existing docs folder. When there is none, in a terminal it asks whether to create `lat.md/` (compatible with the lat command) or `tg.md/`, and `--docs lat.md|tg.md` answers it for scripts; without either, it creates `lat.md/`. The instructions, skills, hooks and ontology guide it installs name the chosen folder.
- The Obsidian plugin reads a `tg.md/` folder in place like a `lat.md/` one, and the VS Code extension treats either folder as set up.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `tg-cli`: root discovery and the docs folder.
- `tg-agent-integration`: choosing the docs folder in `tg init`.
- `lat-vault-integration`: reading a `tg.md/` folder in place.
- `vscode-extension`: setup detection with either folder.

## Impact

- `packages/cli`: `root.mts`, `project.mts`, `check`, `export`, `hook`, `init` and the `Io.select` prompt in `tui.mts`; templates rewritten to the chosen folder at install time.
- `packages/plugin/src/lat-links.ts`, `packages/vscode/src/setup.ts`.
- Tests, `lat.md/cli.md`, the test specs and site docs.
