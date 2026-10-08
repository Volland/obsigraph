---
lat:
  require-code-mention: true
---
# Vector Index Tests

Test specifications for the sidecar's vector index described in [[vector-search#Vector index]], run with a deterministic counting provider plus one real Ollama check.

## Chunks and edges indexed

Each note contributes one vector per chunk and each edge one sentence vector; search cites the best chunk's heading.

## Model identity recorded

Status reports the provider, model and dimension the index was built with, and the vector counts.

## Model change blocks writes

With a different model active, edits are not embedded, searches answer from the stale index with a notice, and an explicit rebuild re-embeds with the new model.

## Dimension change refuses queries

When the stored vectors have 768 dimensions and the active model 1024, node search, edge search and retrieve answer 503 asking for a rebuild.

## Only edited chunk re-embedded

Editing one section of a five-section note embeds exactly that one chunk.

## Removed edge and note dropped

A removed edge loses its sentence vector, and a deleted note loses all its vectors and its file.

## Rename reuses vectors

Moving a note to another folder re-attributes its vectors without embedding any chunk text again.

## Top nodes with citations

Node search returns at most k results by descending score, each citing its best chunk.

## Edge search returns sentences

Edge search finds the edge whose sentence matches and returns the sentence, edge id and citation.

## Search then traverse

Search hits feed a Cypher query as `$hits`, here reaching the companies of the top people.

## Type filter

A type filter restricts node search to nodes with that label.

## Rebuild gives same results

Deleting the index storage and rebuilding gives identical search results.

## Provider down keeps old vectors

While the provider is down, edits queue as pending, status is degraded and search reports unavailability; the index catches up when the provider returns.

## Provider unreachable at start

The service starts with the provider down, answers graph queries, reports degraded vectors and recovers on its own.

## Search request validated

Empty queries, out-of-range k and unknown targets are rejected, and a disabled index answers 503 without creating storage.

## Real Ollama semantic search

With local Ollama, the index is built with `nomic-embed-text` (768 dims), unrelated notes stay out of topical results, and the meeting edge is found by meaning.
