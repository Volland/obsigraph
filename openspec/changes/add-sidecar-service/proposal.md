## Why

Agents and other tools need the vault graph and vector search without Obsidian running, and vector search is otherwise desktop-only. A headless service that reuses the plugin's core guarantees identical behavior. See lat.md/sidecar.

## What Changes

- Add `packages/sidecar`, a headless Node service packaged as a Docker image.
- Mount the vault read-only, watch it, and keep the Ladybug mirror and vector index current using the same `core` package as the plugin.
- Expose a REST API for health, status, Cypher query and vector search, protected by a bearer token and bound to loopback by default.
- Persist derived data in a separate writable volume; the vault is never written.

## Capabilities

### New Capabilities
- `sidecar-service`: Headless, read-only-mounted service that syncs a vault to graph and vector storage and serves it over an authenticated REST API.

### Modified Capabilities

## Impact

- New package `packages/sidecar`, Dockerfile and compose example. Depends on `edge-parsing`, `graph-model`, `cypher-query`, Ladybug mirror, `embedding-provider`, `chunking-verbalization` and `vector-index`. The MCP server and hybrid retrieve come in `add-sidecar-mcp-graphrag`.
- Assumptions: Ollama runs on the host and the container reaches it through a configurable URL (for example `host.docker.internal`). Default listen is `127.0.0.1` inside the published port mapping `127.0.0.1:PORT`. The token is supplied by environment variable or file; the service refuses to start without one unless explicitly told to run unauthenticated on loopback. One vault per container.
