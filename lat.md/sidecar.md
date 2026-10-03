# Sidecar

A headless Docker service that mounts a vault read-only and serves it as RAG-ready graph and vector storage, with no Obsidian running.

## Shared core

The sidecar imports the same `core` package as the plugin, so edge syntax, IDs and queries behave identically in both.

It watches the vault directory, maintains the [[ladybug-mirror|Ladybug mirror]] and the [[vector-search|vector index]] server-side, which also lifts the desktop-only limit on vector search.

[[packages/sidecar/src/sync.ts#VaultSync]] builds the graph from every note on start, then hands only files whose content hash changed since the stored state to downstream processors (the mirror and vectors plug in here). It watches with debounced native events, a one-time catch-up scan after the watcher starts, and an optional polling fallback for bind mounts. Frontmatter is parsed with a YAML library and links resolve like Obsidian through [[packages/core/src/graph/resolve.ts#pathResolver]].

## Interfaces

The sidecar exposes a REST API and an MCP server offering Cypher queries, vector search and a hybrid GraphRAG retrieve call.

Hybrid retrieve takes vector hits, expands their graph neighborhood and returns cited chunks, so agents such as Claude can use the vault directly.

Implemented so far by [[packages/sidecar/src/http.ts#createApi]]: `GET /health` (open), `GET /status` and `POST /query` with `{query, params}`. Results use the plugin's contract, serialized by [[packages/core/src/cypher/json.ts#toJsonValue]] with `_type`-tagged nodes, relationships and paths. Errors are JSON `{error: {kind, message, line?, column?}}`: 400 for syntax, unsupported and read-only, 504 for timeouts, never stack traces.

## Security

The service is read-only toward the vault and safe by default on the network; it is configured through `OBSIGRAPH_*` environment variables.

- The vault is mounted `:ro`; every write goes through [[packages/sidecar/src/data-dir.ts#DataDir]], which refuses paths outside the data directory or inside the vault. [[packages/sidecar/src/config.ts#loadConfig]] refuses to start without a writable data directory outside the vault.
- A bearer token (`OBSIGRAPH_TOKEN` or `OBSIGRAPH_TOKEN_FILE`) is required on everything but `/health`, compared in constant time over SHA-256 digests and redacted from logs. Without one the service refuses to start unless `OBSIGRAPH_ALLOW_NO_AUTH=1`, which is loopback-only.
- Binds `127.0.0.1` by default. The container binds `0.0.0.0` but the compose example publishes only on host loopback; any non-loopback bind logs a TLS warning unless `OBSIGRAPH_BEHIND_TLS_PROXY=1`.
- Request bodies are size-limited and queries carry a cooperative deadline checked inside the matcher, so a runaway traversal aborts with a timeout.
- The image runs as the non-root `node` user; the compose example adds a read-only root filesystem, dropped capabilities and a Docker secret for the token.
