## Why

The plugin's "Show diagnostics" is the only place that validates a vault against its schemas, and it needs Obsidian open. `tg check` validates lat.md links and annotations but knows nothing about schema notes, edge syntax errors or embeds, and `tg okf check` covers only Open Knowledge Format rules. There is no way to validate a vault in CI, in a pre-commit hook, from an agent, or on a machine without Obsidian, even though the engine that produces all of these diagnostics already lives in the host-independent core.

## What Changes

- New command `tg validate [--vault dir] [--schema-folder Types] [--json] [--strict] [--only kinds] [--format text|json|sarif]` that loads every note in a vault into the core graph and reports the same diagnostics the plugin shows: edge syntax errors, schema declaration problems (the TGS diagnostics), schema validation of every typed note and edge, style and visualization problems, and edge embed warnings.
- Every finding gets a stable machine-readable code (the TGS diagnostic names, plus `edge-syntax`, `style`, `embed`), a severity, a path and a line, so tools can filter and suppress by code.
- Exit codes: 0 when there are no errors, 1 when there are findings at or above the failing severity, 2 for bad input. Schema validation findings are warnings by default (the schema is advisory) and `--strict` makes them fail the run, so CI can choose its own bar.
- `--format sarif` writes SARIF 2.1.0 so findings appear as annotations in GitHub code scanning and editors.
- `tg validate --schema-only` checks only the schema notes themselves (declarations, duplicates, prefixes, versions), which is cheap enough for a pre-commit hook.
- The plugin's diagnostics list and the command share one function, so the two cannot disagree.
- `tg check` is unchanged and still agrees with lat.md.

## Capabilities

### New Capabilities
- `tg-validate`: the `tg validate` command, the shared vault validation function, finding codes and severities, output formats and exit codes.

### Modified Capabilities

None. The TGS specification and `schema-notes` already define the diagnostics; this change makes them reachable outside Obsidian.

## Impact

- `packages/core`: a host-independent `validateVault(notes, options)` returning findings with codes and severities, extracted from `VaultIndex.diagnostics()`.
- `packages/cli`: `validate` command, vault reading shared with `schema` and `okf` commands, SARIF writer.
- `packages/plugin`: `VaultIndex.diagnostics()` calls the shared function; no visible change.
- `lat.md`, website docs, a short CI example, and the `tg-agent` hook guidance gain a validate section.
