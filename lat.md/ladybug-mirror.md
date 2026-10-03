# Ladybug Mirror

LadybugDB holds a derived copy of the graph, adding full-language Cypher reads, algorithms and the vector index that the in-plugin engine lacks.

## One-way mirror

Sync flows only from vault to Ladybug; the database is a disposable cache that can be fully rebuilt from markdown.

Sync is incremental per changed file. User queries against the mirror are read-only: `CREATE`, `SET` and `DELETE` are rejected, because nothing would write them back to notes and the next sync would erase or diverge from them.

## Deferred two-way sync

Translating Cypher writes into markdown edits is a possible future feature, not part of v1.

It is hard to place a new edge in a note and to resolve conflicts, so it is deferred until after the one-way mirror is proven.

## Hosted by the sidecar

LadybugDB runs inside the [[sidecar]], not the plugin: Obsidian's plugin store only ships `main.js`, `manifest.json` and `styles.css`, so a native module cannot be distributed.

The plugin reaches it over HTTP for `backend: ladybug` queries. Verified with `@ladybugdb/core` 0.21.2: Node prebuilt binary, schema-ful Cypher, variable-length paths, `array_cosine_similarity`, and a read-only open mode that rejects writes.

## Storage layout

One `Node` table (id, labels list, title, path, stub, JSON props) and one relationship table per edge type (id, sign, heading, JSON props), because a Ladybug node belongs to exactly one table while notes can have several labels.

Queries keep the plugin's text: the backend rewrites label patterns such as `(a:Person)` into label-list checks on `Node` before sending. Text the built-in parser cannot read passes through unchanged, with documented limits.
