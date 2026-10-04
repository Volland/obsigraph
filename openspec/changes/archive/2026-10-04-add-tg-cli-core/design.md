## Context

The plugin and sidecar are already esbuild bundles over `core`. The CLI follows the same pattern. `core` is private and exports TypeScript source, so publishing it as a library would freeze an API too early.

## Goals / Non-Goals

**Goals:** one installable binary, no native or WASM dependencies, startup under 150 ms for `tg check` on a small project, zero required configuration.

**Non-Goals:** a published library API, Windows-specific polish beyond path handling, a plugin system for commands.

## Decisions

**Single bundled package.** `npx @typedgraph/cli` must work with no sibling installs. A layered set was rejected for now because it commits to a public API before users shape it.

**Hand-rolled argument parsing over a framework.** The command set is small and fixed; a dependency would cost startup time and bundle size.

**Root discovery walks upward** for `lat.md/` (or `.tg/`) like git finds `.git`, so hooks work from any subdirectory; `--dir` overrides.

**Machine output is opt-in.** Human text is the default; `--json` is available on every read command for hooks and tests.

## Risks / Trade-offs

- [`@typedgraph` scope not owned] -> publish step is gated on `npm access` check; package name is a single constant.
- [Bundle drift from `core`] -> the CLI build runs in `npm run verify`.
