# Vector Search

Semantic search over nodes and edges, stored in Ladybug's vector index so it can be combined with graph traversal in Cypher.

## Embedding provider

Embeddings come from a pluggable provider, defaulting to a local Ollama `nomic-embed-text` (768 dimensions) at localhost:11434, with any OpenAI-compatible endpoint also accepted.

The model name and dimension are stored with the index; a mismatch triggers a rebuild prompt instead of mixing vectors. Hosted-only is rejected as a default because it sends the vault to a third party.

## Node chunks

Each note is chunked, with its title, type labels and frontmatter prepended to every chunk so a chunk carries its own context.

A node's score is its best-matching chunk, or the pooled vector of its chunks.

## Edge verbalization

Edges have no prose, so each is rendered as a sentence from its triple, labels and properties and that sentence is embedded.

Example: `Alice (Person) knows Bob (Person) - since 2020, met at conf`. This makes edges searchable by meaning. Because the index lives in Ladybug, vector search is desktop-only until the [[sidecar]] hosts it.
