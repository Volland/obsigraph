## 1. Selection and transport

- [x] 1.1 Add the `backend` header option, the plugin default, sidecar URL and token settings, and the header error for unknown values
- [x] 1.2 Add `backend` to the sidecar `/query` route with 503 for unavailable or not-ready mirrors
- [x] 1.3 Plugin remote client mapping every response to a result, a positioned error or a retry, and async block rendering that drops stale answers

## 2. Read-only guard

- [x] 2.1 Lexer-based guard rejecting writes, schema statements, CALL and multiple statements while ignoring strings, comments, properties and labels
- [x] 2.2 Run queries on a read-only snapshot reopened after each mirror sync

## 3. Execution

- [x] 3.1 Mirror format 2: typed property columns, src/dst on relationships, placeholder relationship table
- [x] 3.2 Translate parsed queries onto the mirror layout; pass other text through with a notice
- [x] 3.3 Convert Ladybug values to the JSON wire form and back into plugin values
- [x] 3.4 Wait for pending syncs before reads, flag staleness after a bounded wait, enforce the query timeout

## 4. Tests

- [x] 4.1 Sidecar tests for every ladybug-backend scenario against real LadybugDB, plus plugin tests with a fake fetcher and one real sidecar

## 5. Sync

- [x] 5.1 Update lat.md/query-engine and lat.md/ladybug-mirror, add test-spec sections and `@lat:` refs, run `npm run verify` and `openspec validate add-ladybug-backend --strict`
