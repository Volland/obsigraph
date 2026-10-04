## Why

The core of lat.md is `check`, `locate`, `section`, `refs` and `expand`. They are what agents and CI call. They must give the same verdicts as lat.md or "drop-in replacement" is false.

## What Changes

- `tg locate`, `tg section`, `tg refs`, `tg expand`, `tg check` built on the lat resolver, with text and `--json` output close to lat's.
- `tg check` validates wiki links, code refs, the leading-paragraph rule and `require-code-mention` coverage.
- A differential parity suite runs `lat check` and `tg check` over this repository's `lat.md/` and fixture copies of real lat.md projects and asserts the same pass/fail and the same error set. It is a release gate.
- Decision: one release, so the parity gate runs in CI continuously during the build and blocks the release.
- Assumption: `lat.md` is installable in CI as a dev-only reference for the suite.

## Capabilities

### New Capabilities
- `tg-check`: The five read commands and their validation rules.

### Modified Capabilities

## Impact

- Commands in `packages/cli`; logic in `packages/core/src/latmd/`. Fixture projects under `packages/cli/test/fixtures/`.
- Depends on `add-tg-cli-core`, `add-tg-lat-resolver`; code-ref checks use `add-tg-annotations` and `add-tg-symbol-provider`.
