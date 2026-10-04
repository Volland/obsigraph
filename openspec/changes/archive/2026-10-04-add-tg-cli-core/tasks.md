## 1. Package

- [x] 1.1 Create `packages/cli` with esbuild config bundling to a single `tg.mjs` with a shebang
- [x] 1.2 Add typecheck and build to `npm run verify`
- [x] 1.3 Implement argument parsing, help text and `--version`

## 2. Conventions

- [x] 2.1 Implement root discovery and `--dir`
- [x] 2.2 Implement `--json`, `--no-color`, `--verbose` and the exit-code contract (0 ok, 1 findings, 2 usage or internal error)

## 3. Release

- [x] 3.1 Extend `scripts/version-bump.mjs` to bump the CLI package
- [x] 3.2 Add an `npm publish --access public` step to the tag workflow, guarded by a scope check

## 4. Tests

- [x] 4.1 Write tests covering every scenario in the tg-cli spec

## 5. Sync

- [x] 5.1 Document the CLI in lat.md/cli, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
