# Ladybug Mirror

LadybugDB holds a derived copy of the graph, adding full-language Cypher reads, algorithms and the vector index that the in-plugin engine lacks.

## One-way mirror

Sync flows only from vault to Ladybug; the database is a disposable cache that can be fully rebuilt from markdown.

Sync is incremental per changed file. User queries against the mirror are read-only: `CREATE`, `SET` and `DELETE` are rejected, because nothing would write them back to notes and the next sync would erase or diverge from them.

## Deferred two-way sync

Translating Cypher writes into markdown edits is a possible future feature, not part of v1.

It is hard to place a new edge in a note and to resolve conflicts, so it is deferred until after the one-way mirror is proven.
