## Why

Obsigraph has no command line and publishes nothing to npm. To replace lat.md, a standalone `tg` binary must exist that runs anywhere without Obsidian, starts fast enough for agent hooks, and installs with one `npx`.

## What Changes

- New workspace package `packages/cli`, published as `@typedgraph/cli` with `bin: { tg }`, bundled with esbuild so `core` is inlined and nothing else is published.
- Project-root discovery (`--dir`, else walk up to the nearest `lat.md/` or `.tg/`), uniform output and exit codes, `--no-color`, `--verbose`.
- Release flow: `scripts/version-bump.mjs` also bumps the CLI, and the tag workflow publishes it.
- Decision: one bundled package now; a layered `@typedgraph/core` is deferred. Workspace names stay `@obsigraph/*`.
- Assumption: the `@typedgraph` npm scope is owned by the maintainer; it could not be verified from the design session.

## Capabilities

### New Capabilities
- `tg-cli`: Entry point, root discovery, output and exit-code contract, packaging and release.

### Modified Capabilities

## Impact

- New `packages/cli`, root `package.json` scripts, `scripts/version-bump.mjs`, release workflow. No change to plugin or sidecar behavior.
- Every other `add-tg-*` change registers its commands here.
