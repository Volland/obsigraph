---
lat:
  require-code-mention: true
---
# Mirror Sync Tests

Test specifications for the one-way LadybugDB mirror in [[ladybug-mirror]], run mostly against an in-memory store plus one round trip through the real database.

## External edits never reach notes

Tampering with the mirror never changes the graph, and a rebuild restores the mirror to match the vault.

## Delete and rebuild

After the mirror is wiped, a rebuild from the graph alone holds exactly the graph's nodes and edges.

## Incremental equals rebuild

Across 25 random sequences of note creates, edits and deletes, the incrementally synced mirror equals a fresh rebuild and the graph.

## Edge removed from note

Removing an edge line removes that edge from the mirror and keeps the others.

## Note renamed

A rename moves the node and its outgoing edges; edges from other notes that still use the old link text point at a stub.

## Deleted note becomes stub

Deleting a linked note leaves its incoming edges pointing at a stub node with no path.

## Signed edge with properties

A negative edge keeps its type, sign -1, pinned id, heading and JSON properties.

## Multiple labels kept

A node keeps every label in order, plus its frontmatter properties.

## Parallel edges kept

Two identical-type edges between the same notes stay separate rows with distinct ids.

## Format change rebuilds

A stored manifest with another format version triggers a rebuild that drops stale rows.

## Interrupted sync rebuilds

A failed sync reports `failed` with the message, leaves the manifest in progress, and the next open rebuilds.

## Disabled by configuration

With the mirror disabled, no mirror directory is created and built-in queries work.

## Not installed reported

When the native module cannot load, status reports the mirror unavailable with the reason and queries keep working.

## Large build does not block queries

While a slow initial build runs, status shows syncing and built-in queries still answer.

## Real LadybugDB round trip

The real store mirrors the graph (including a reserved `node` edge type), answers Cypher with label-list checks, applies edits incrementally and reopens without a rebuild.
