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

`Node` holds id, labels list, title, path, stub, JSON props and sig; each relationship table holds id, sign, heading, src and dst ids, JSON props and sig, created on first use by [[packages/sidecar/src/mirror/store.ts#LadybugStore]]. Every property also gets a typed column per name and kind, `p_<name>_<kind>` (number, text, boolean, text list, number list, JSON text), added on demand, because JSON-in-a-string properties cannot be compared natively. An always-empty `obsigraph_none` relationship table keeps patterns over missing edge types valid. An edge type named `node` uses table `node_`. Set `OBSIGRAPH_LADYBUG=0` to disable the mirror; when the module cannot load, status reports it unavailable with the reason.

## Query translation

`backend: ladybug` queries keep the plugin's text and results: the sidecar translates what the built-in parser reads, and passes other read syntax through.

[[packages/sidecar/src/ladybug/transpile.ts#transpile]] turns `(a:Person)` into `(a:Node)` plus `list_contains(a.labels, 'Person')`, `n.age` into the typed column (mixed-type properties use one kind and add a notice), `n.title`/`n.stub`/`r.id`/`r.sign` into base columns, unbounded `*` into `*1..cap`, and maps functions (`toLower`→`lower`, `type`→`label`, 0-based `substring` and indexes to 1-based). RETURN columns are aliased internally so names and kinds match the built-in engine; `ORDER BY` on aliases is rewritten accordingly. `startNode`, `endNode`, `keys` and `properties` are unsupported there.

[[packages/sidecar/src/ladybug/backend.ts#LadybugBackend]] checks [[packages/sidecar/src/ladybug/guard.ts#assertReadOnly]], waits up to 3 s for pending syncs (else adds a staleness notice), answers `not_ready` until the mirror first matches the graph, and runs on a read-only snapshot reopened after each sync, with the query timeout. Results are converted back to the plugin's wire form, nodes with parsed properties and relationships with their source and target ids. Known engine difference: in raw pass-through text, `ORDER BY x` where `x` is both an alias and a node variable binds to the node.
