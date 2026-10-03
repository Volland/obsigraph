# Ladybug Mirror

LadybugDB holds a derived copy of the graph, adding full-language Cypher reads, algorithms and the vector index that the in-plugin engine lacks.

## One-way mirror

Sync flows only from vault to Ladybug; the database is a disposable cache that can be fully rebuilt from markdown.

[[packages/sidecar/src/mirror/mirror.ts#LadybugMirror]] keeps a content signature per mirrored node and edge; each sync diffs the whole graph against them ([[packages/sidecar/src/mirror/rows.ts#diffMirror]]) and applies only the difference in one transaction, so incremental sync equals a rebuild by construction and edges in untouched files whose targets re-resolved are covered. A manifest (format version, in-progress or complete) makes any missing, stale, interrupted or failed state rebuild on next open. Syncs run in the background and coalesce bursts. User queries against the mirror are read-only: `CREATE`, `SET` and `DELETE` are rejected, because nothing would write them back to notes and the next sync would erase or diverge from them.

## Deferred two-way sync

Translating Cypher writes into markdown edits is a possible future feature, not part of v1.

It is hard to place a new edge in a note and to resolve conflicts, so it is deferred until after the one-way mirror is proven.

## Hosted by the sidecar

LadybugDB runs inside the [[sidecar]], not the plugin: Obsidian's plugin store only ships `main.js`, `manifest.json` and `styles.css`, so a native module cannot be distributed.

The plugin reaches it over HTTP for `backend: ladybug` queries. Verified with `@ladybugdb/core` 0.21.2: Node prebuilt binary, schema-ful Cypher, variable-length paths, `array_cosine_similarity`, and a read-only open mode that rejects writes.

## Storage layout

One `Node` table and one relationship table per edge type, because a Ladybug node belongs to exactly one table while notes can have several labels.

`Node` holds id, labels list, title, path, stub, JSON props and sig; each relationship table holds id, sign, heading, JSON props and sig, created on first use by [[packages/sidecar/src/mirror/store.ts#LadybugStore]]. An edge type named `node` uses table `node_`. Set `OBSIGRAPH_LADYBUG=0` to disable the mirror; when the module cannot load, status reports it unavailable with the reason.

Queries keep the plugin's text: the backend rewrites label patterns such as `(a:Person)` into label-list checks on `Node` before sending. Text the built-in parser cannot read passes through unchanged, with documented limits.
