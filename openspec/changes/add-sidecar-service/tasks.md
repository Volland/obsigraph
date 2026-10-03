## 1. Package and container

- [ ] 1.1 Create `packages/sidecar` importing `core`, with configuration from environment and files
- [ ] 1.2 Add a Dockerfile (non-root user) and a compose example with the vault mounted `:ro`, a data volume, and loopback port publish

## 2. Sync

- [ ] 2.1 Implement startup reconcile using file mtime and content hash against stored state
- [ ] 2.2 Implement the debounced watcher with a polling fallback
- [ ] 2.3 Drive the Ladybug mirror and vector index per changed file using the shared core
- [ ] 2.4 Report sync progress, pending files and model mismatch in status

## 3. REST API

- [ ] 3.1 Implement health, status, Cypher query and vector search endpoints
- [ ] 3.2 Implement bearer token auth with constant-time compare, startup refusal without a token, and log redaction
- [ ] 3.3 Implement loopback default bind, explicit wide bind with a warning, body size limit and query timeout
- [ ] 3.4 Reject write Cypher clauses with a clear error

## 4. Tests

- [ ] 4.1 Add a conformance test running fixture vaults and queries through the plugin engine and the sidecar
- [ ] 4.2 Write tests covering every scenario in the sidecar-service spec, including a read-only mount check

## 5. Sync

- [ ] 5.1 Update lat.md/sidecar, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
