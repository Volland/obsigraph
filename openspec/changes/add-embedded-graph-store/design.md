## Context

The sidecar's `LadybugMirror` already proves the model: a signature per node and edge, a whole-graph diff (`diffMirror`) applied in one transaction, a manifest that forces a rebuild after an interrupted or incompatible sync, and a read-only snapshot for queries. It is tied to the native module and to Node. The plugin keeps its graph in memory through `VaultIndex`, which already emits debounced change notifications for modify, metadata, delete and rename events. The CLI rebuilds everything on every call and stores vectors in two flat files keyed by a model label, which it silently discards when the label changes.

Measured with `@ladybugdb/wasm-core` 0.21.2 on macOS, Node 26: `CREATE_VECTOR_INDEX`, `QUERY_VECTOR_INDEX`, `CREATE_FTS_INDEX` and `QUERY_FTS_INDEX` all work with no `INSTALL`; `INSTALL`/`LOAD` fail with "Extensions are not available in the WASM environment" because they are already linked. Vector and FTS indexes exist only on node tables ("is not of type NODE" for a rel table). A vector hit can feed a `MATCH` in the same query. Cold require plus init 40 ms, open plus FTS query about 230 ms, RSS about 350 MB with the default buffer pool. The default browser build is one 23 MB worker script with the WASM inlined (4.2 MB gzipped); the Node build is a 14.6 MB `.wasm`.

## Goals / Non-Goals

**Goals:**
- One store abstraction and one schema across plugin (desktop and mobile), CLI, VS Code and sidecar.
- Incremental sync that is equal to a rebuild by construction, on every host.
- No network, no native binaries and no cross-origin isolation for user-facing hosts.

**Non-Goals:**
- Embedding, ranking, UI (later changes).
- Writes from the store back to markdown (still deferred, see ladybug-mirror).
- Replacing the plugin's in-memory query engine: `graph-query` blocks keep running on it.

## Decisions

**1. Builds per host.** Plugin: default async WASM build in a dedicated Worker, created from a Blob URL of the string bundled in `main.js`, instantiated only on first use. CLI and VS Code: `nodejs/sync` build, because a short-lived process gains nothing from a worker and the sync API keeps the code simple. Sidecar: native, for multithreaded bulk sync; its image pre-installs `vector` and `fts`. Alternatives (WASM in the sidecar too; native in the CLI) are recorded in ADR 0001.

**2. `GraphStore` interface.** `open(location, {bufferPoolBytes, readOnly})`, `exec(ddl)`, `query(cypher, params) → rows`, `transaction(fn)`, `close()`, `drop()`. Async everywhere; the sync driver wraps its results in resolved promises. The interface is small on purpose so a fourth driver (for example OPFS-backed) needs no other change.

**3. Schema in `core`.** `storeSchema(dimension | null)` returns the DDL: today's `Node` table and per-type relationship tables with typed property columns, the `obsigraph_none` table, and a `StoreMeta` node table holding format version, state (`building`, `complete`), corpus kind (`vault` or `lattice`), the model fingerprint (null until add-local-embedding) and per-file content hashes. Format version bumps force a rebuild, as the mirror's manifest does today. The sidecar switches its DDL to this module with no layout change.

**4. Rows and diff move to `core`.** `graphRows`, `diffMirror`, `applyToState`, `propertyTypes`, `relTable` move unchanged except that signatures use `core`'s `stableId` instead of `node:crypto` sha256. This changes signature values, so the sidecar mirror rebuilds once after upgrade, which is safe because it is derived.

**5. Two-phase sync.** Phase 1 (structure): given the current in-memory graph and the store's signatures, compute the diff, apply it in one transaction, then rebuild affected FTS indexes. Phase 1 also writes the text of every searchable unit with its text hash and an empty vector. Phase 2 (vectors): an `EmbeddingQueue` interface lists units whose text hash has no vector; this change ships a no-op queue, add-local-embedding fills it. Phase 1 never waits for Phase 2.

**6. Locations.** CLI: `<root>/.tg/graph.lbug`, `.tg/.gitignore` containing `*` as today. Plugin: IDBFS mount `/typed-graph/<vault-id>/graph.lbug`, where vault id is a hash of the vault's adapter base path plus vault name, so two vaults on one device never share a store. The plugin never writes the store to the vault or to `.obsidian/`, which sync tools copy between devices (ADR 0003). Sidecar: the data directory, as today.

**7. Catch-up.** The store keeps per-file `(mtime, size, contentHash)`. CLI: before `search` and `cypher`, stat every corpus file, hash only those whose mtime or size differ, rebuild the graph and run Phase 1. Plugin: at first open after start, the same comparison through the vault adapter, then live through `VaultIndex` notifications. Files that arrive through Obsidian Sync or iCloud fire the same vault events, so no special path is needed.

**8. Hooks never open the store.** `tg hook` keeps its lexical-only in-memory search (lat.md's read-only lesson): a prompt must never wait for a build.

**9. Memory.** Every driver passes an explicit buffer pool: 64 MB by default, 32 MB when the plugin runs on mobile (`Platform.isMobile`), overridable in settings and with `TG_STORE_BUFFER_MB`.

**10. Corruption.** A store that fails to open, or whose `StoreMeta` says `building` at open, is dropped and rebuilt once; if that fails the host keeps working without it and reports why (the sidecar's `openMirror` behavior, generalized).

## Risks / Trade-offs

- [`main.js` grows by about 23 MB; mobile startup could slow] → The engine stays an unparsed string until first use; the spike (task 1) measures cold start on a mid-range Android phone and an iPhone and must stay within 300 ms of today's startup, else the engine moves to lazy-evaluated code split inside `main.js` or the design is revisited before add-plugin-search.
- [IDBFS on iOS WebKit can be evicted under storage pressure] → The store is derived; eviction means a rebuild, reported in status, with the vector pack (add-local-embedding) avoiding re-embedding.
- [IDBFS persists by explicit sync, so a crash can lose the last writes] → Persist after each Phase 1 transaction and at most every 10 s during Phase 2; a lost tail is caught up by the content-hash comparison.
- [WASM is slower than native] → Vault-scale corpora (under 50k units) are well within budget; the sidecar keeps native for large vaults.
- [Signature change rebuilds existing sidecar mirrors once] → Documented in the changelog; derived data.

## Migration Plan

CLI deletes `.tg/vectors.json` and `.tg/vectors.f32` on first run and builds `.tg/graph.lbug`. Sidecar mirrors rebuild once because signatures change. The plugin has no prior store.

## Open Questions

- Whether OPFS (faster, synchronous access handles in a Worker) is available in Obsidian's iOS WebView; if yes it can replace IDBFS behind the same interface.
