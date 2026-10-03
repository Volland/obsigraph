## Context

The sidecar is the third package in the monorepo (`core`, `plugin`, `sidecar`). It runs without Obsidian, imports `core` unchanged, and owns the Ladybug mirror and vector index for a vault. Motivation: lat.md/sidecar and lat.md/architecture.

## Goals / Non-Goals

**Goals:** identical semantics to the plugin, safe-by-default deployment, resumable sync, a small stable REST surface.

**Non-Goals:** MCP and hybrid GraphRAG retrieve (next change), multi-vault, multi-user authorization, writing to the vault, TLS termination in the service.

## Decisions

**Node service in Docker, one vault per container.** Alternative, a desktop-only helper process, would not serve headless or remote agents. One vault keeps data directories and auth simple.

**Read-only enforced twice.** Docker mounts the vault `:ro`, and the code never opens vault files for writing. Derived data lives in a separate volume. A mounted-writable vault is tolerated but never written.

**Reuse `core` via workspace import.** A cross-engine conformance test runs fixtures through plugin engine and sidecar to keep behavior identical.

**File watching with debounce, plus a polling fallback and a startup reconcile.** Bind mounts on macOS and network volumes often drop native events. The startup reconcile compares file mtime and content hash with stored state so changes made while stopped are caught.

**Security.**
- Bearer token required on all endpoints except health; constant-time comparison; token from env or file, never logged or echoed in status.
- Bind to `127.0.0.1` by default; compose example publishes `127.0.0.1:PORT`. Wide bind needs explicit config and warns; TLS is expected from a reverse proxy.
- Read-only query surface: write clauses rejected, query timeout and body size limits, errors without stack traces.
- Container runs as a non-root user; no extra capabilities; vault mount `:ro`.
- Health reveals nothing about vault contents.
- Alternative considered: no auth on loopback. Rejected as default because other local processes and browser pages could reach it; allowed only through an explicit override.

**Fastify-style minimal HTTP layer, no framework features beyond routing.** Implementation detail left to apply; the spec states only the observable contract.

**Assumption:** Ollama is reached via configurable URL; inside Docker on macOS that is typically `host.docker.internal:11434`.

## Risks / Trade-offs

- [Missed file events on bind mounts] -> polling fallback and startup reconcile.
- [Ladybug data corrupted or incompatible after upgrade] -> derived store, rebuild command; format version stored in metadata.
- [Token exposure through process list or logs] -> file-based secret option, redaction in logs.
- [Exposing the whole vault over the network] -> loopback default, auth, documented proxy setup.
- [Embedding backlog on first sync of a big vault] -> status shows progress; graph queries available before vectors finish.
