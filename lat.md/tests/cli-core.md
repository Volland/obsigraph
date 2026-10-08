---
lat:
  require-code-mention: true
---
# CLI Core Tests

Test specifications for the `tg` entry point, root discovery, output contract and packaging described in [[cli#Packaging]].

## Project root discovery

How `tg` decides which directory is the project.

### Run from a subdirectory

Running from `src/auth/` of a project whose root holds `lat.md/` finds that root by walking upward, so hooks work from any directory.

### Explicit directory

`--dir` wins over the working directory, so a command can target another project without changing directory.

### No project found

With no `lat.md/` or `.tg/` above the working directory a command exits 2 and suggests `tg init`.

## Output and exit codes

The contract hooks and CI rely on.

### Findings

A command that reports findings exits 1, distinct from exit 2 for usage and internal errors.

### JSON output

`--json` makes stdout a single JSON document and nothing else.

### No match

Under `--json`, `section`, `refs`, `locate`, `expand`, `search` and `edges` print exactly one JSON document when nothing matches or a ref fails, and still exit 1.

## Single bundled package

The package ships as one npm package.

### Clean install

`@typedgraph/cli` declares no runtime dependencies and exposes the `tg` binary, so `npx` needs nothing else.
