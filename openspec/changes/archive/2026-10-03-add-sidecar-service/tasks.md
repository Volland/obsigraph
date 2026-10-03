## 1. Package and container

- [x] 1.1 Create `packages/sidecar` importing `core`, with configuration from environment and files
- [x] 1.2 Add a Dockerfile (non-root user) and a compose example with the vault mounted `:ro`, a data volume, and loopback port publish

## 2. Sync

- [x] 2.1 Implement startup reconcile using file mtime and content hash against stored state
- [x] 2.2 Implement the debounced watcher with a polling fallback
- [x] 2.3 Hand changed and removed files to downstream processors (mirror and vectors come later)
- [x] 2.4 Report sync state, pending files and last sync time in status

## 3. REST API

- [x] 3.1 Implement health, status and Cypher query endpoints
- [x] 3.2 Implement bearer token auth with constant-time compare, startup refusal without a token, and log redaction
- [x] 3.3 Implement loopback default bind, explicit wide bind with a warning, body size limit and query timeout
- [x] 3.4 Reject write Cypher clauses with a clear error

## 4. Tests

- [x] 4.1 Add a conformance test running fixture vaults and queries through the plugin engine and the sidecar
- [x] 4.2 Write tests covering every scenario in the sidecar-service spec, including a read-only mount check

## 5. Sync

- [x] 5.1 Update lat.md/sidecar, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
