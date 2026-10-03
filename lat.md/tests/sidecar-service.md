---
lat:
  require-code-mention: true
---
# Sidecar Service Tests

Test specifications for the headless service in [[sidecar]], run against real servers on temporary vault and data directories.

## Read-only vault

With the vault's files and folders made read-only, the service indexes it, serves queries, leaves its tree byte-for-byte unchanged and writes only its state file into the data directory.

## Data directory required

A missing data directory, or one inside the vault, stops startup with an error naming the directory.

## Same results as plugin engine

For the same notes, REST results equal the plugin engine's results serialized to JSON, across nodes, relationships, signs, stubs and paths.

## First start indexes everything

On first start every markdown note outside dot folders reaches processors and status reports ready with note and edge counts.

## Restart reprocesses only changes

After a restart, only notes edited, added or deleted while stopped reach processors.

## Live edit becomes queryable

An edited note's new edge, a new note in a new folder, and a deleted note are reflected in query results shortly after.

## Burst of saves coalesced

Ten rapid saves of one file are processed once.

## Polling fallback

With native events unavailable and polling enabled, a change is still detected.

## Writes rejected over REST

`CREATE` over REST returns 400 naming the clause and changes nothing.

## Health and status

Health answers without a token; status needs one and reports counts, sync state and placeholders for vectors; unknown routes and wrong methods get 404 and 405.

## Query contract over REST

Query responses carry `{columns, rows}` with column kinds and `_type`-tagged node and relationship values.

## Token required

Missing and wrong tokens get 401, the comparison is exact, and the token never appears in logs.

## No token refuses to start

Startup without a token fails unless the unauthenticated override is set, which is refused off loopback; tokens can come from a file.

## Loopback by default

The default bind is loopback, and an explicit wide bind works but logs a warning about unencrypted traffic.

## Bounded requests

Oversized bodies get 413, and a runaway traversal is cut off with a 504 timeout error that carries no stack trace.
