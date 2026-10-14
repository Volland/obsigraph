## Why

`tg init` is a dry run unless `--write` is passed, a habit carried over from its first version. In practice everyone runs it to set a project up, so the first run prints a long diff, writes nothing, and the person has to run it again with a flag. lat.md's own `init` writes directly. The terminal setup already asks what to set up, which makes a second confirmation and a separate write flag redundant.

## What Changes

- `tg init` writes by default, in a terminal and in scripts.
- `--dry-run` prints the diff of every file it would create or change and writes nothing.
- In a terminal, the checklists are the review: after them `tg init` writes and lists the files it created or updated, with no extra "Write N files?" question.
- `--write` is still accepted and changes nothing, so existing scripts, the published VS Code extension and older CLIs keep working.
- `--migrate` no longer needs `--write`.
- Three more coding agents, with OpenSpec's ids and folders: Kilo Code (`kilocode`, `.kilocode/skills`), Pi (`pi`, `.pi/skills`) and Oh My Pi (`oh-my-pi`, `.omp/skills`), all using `AGENTS.md` for instructions.
- `tg init` sets up the folder it runs in (or the one given), never a parent project above it. Before, a `lat.md/` anywhere higher up captured it: a clone of the lat.md tool's own repository at `~/Documents/work/lat.md/` made every new project under `~/Documents/work/` write its files into `~/Documents/work/`.
- A `lat.md/` or `tg.md/` folder that is its own git repository no longer counts as a docs folder for any command.
- Docs, the agent instructions, the VS Code README and the website say `tg init` and `tg init --dry-run`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `tg-cli`: root discovery ignores a docs-named folder that is its own git repository.
- `tg-agent-integration`: safe init (own folder), interactive setup, migration, and the agent list in selection, detection and skills.

## Impact

- `packages/cli/src/commands/init.mts`, `agents.mts` and their tests.
- `lat.md/cli.md`, `lat.md/vscode.md`, test specs, `README.md`, `site/docs.html`, `packages/vscode/README.md`.
