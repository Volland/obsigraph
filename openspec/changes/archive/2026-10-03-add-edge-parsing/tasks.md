## 1. Monorepo setup

- [x] 1.1 Create npm workspaces with `packages/core` and `packages/plugin`, TypeScript config and Vitest
- [x] 1.2 Add a test that fails if `packages/core` imports `obsidian` or DOM globals

## 2. Edge parsing

- [x] 2.1 Implement the line scanner that finds edge lines and skips fenced code blocks
- [x] 2.2 Implement the tolerant property-block parser
- [x] 2.3 Implement sign-prefix handling with default +1, independent of `weight`
- [x] 2.4 Record the nearest preceding heading as edge metadata
- [x] 2.5 Emit diagnostics for malformed property blocks while keeping the edge
- [x] 2.6 Write tests covering every scenario in the edge-parsing spec

## 3. Sync

- [x] 3.1 Add lat.md test-spec section and `@lat:` refs, link parser symbols from lat.md/edge-syntax, run `lat check` and `openspec validate`
