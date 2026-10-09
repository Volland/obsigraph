---
openspec: [chunking-verbalization, embedding-provider, sidecar-service, vector-index]
---
# Vector Search

Semantic search over nodes and edges, stored as JSON files in the sidecar data directory and combined with graph traversal through a follow-up Cypher query.

## Embedding provider

Embeddings come from a pluggable provider, defaulting to a local Ollama `nomic-embed-text` (768 dimensions) at localhost:11434, with any OpenAI-compatible endpoint also accepted.

The model name and dimension are stored with the index; a mismatch blocks writes until `POST /vectors/rebuild` instead of mixing vectors. Hosted-only is rejected as a default because it sends the vault to a third party.

Implemented by `OllamaProvider` (`packages/sidecar/src/vectors/provider.mts`) (`/api/embed`) and `OpenAIProvider` (`packages/sidecar/src/vectors/provider.mts`) (`/embeddings`), both batching with bounded concurrency while keeping input order, configured on the sidecar through `OBSIGRAPH_EMBED_PROVIDER`, `OBSIGRAPH_EMBED_URL`, `OBSIGRAPH_EMBED_MODEL`, `OBSIGRAPH_EMBED_KEY` or `OBSIGRAPH_EMBED_KEY_FILE` and `OBSIGRAPH_EMBED_BATCH`, with `OBSIGRAPH_EMBED_TIMEOUT_MS` (default 30 s) bounding each request. Errors name the endpoint or model, and a missing Ollama model is never pulled automatically. An unanswered request fails as unreachable after the timeout, so `tg search`, which uses the same provider classes, falls back to lexical results instead of hanging. A response with empty vectors or vectors of different lengths is rejected as a bad response, and [[packages/core/src/embed/chunk.ts#cosine]] throws on vectors of different length instead of returning NaN. `identityMismatch` (`packages/sidecar/src/vectors/provider.mts`) guards the index. The plugin itself never embeds; vectors live with the sidecar.

## Node chunks

Each note is chunked, with its title, type labels and frontmatter prepended to every chunk so a chunk carries its own context.

A node's score is its best-matching chunk, or the pooled vector of its chunks.

[[packages/core/src/embed/chunk.ts#chunkNote]] splits by heading, then packs paragraphs, sentences and words under a character limit (default 1500, context included); the stored body is returned in citations while the embedded text carries the context. Chunk ids hash path, heading path, ordinal and body with a pure-JS hash, so unchanged chunks keep their ids. [[packages/core/src/embed/chunk.ts#nodeScore]] implements both scoring modes.

## Edge verbalization

Edges have no prose, so each is rendered as a sentence from its triple, labels and properties and that sentence is embedded.

Example: `Alice (Person) knows Bob (Person) - since 2020, met at conf`. This makes edges searchable by meaning. [[packages/core/src/embed/chunk.ts#verbalizeEdge]] turns `worksAt` or `works_at` into `works at`, appends `(negative)` for sign -1, shows `label` bare and other properties as `key value`, omits the pinned id, and records edge id, source path and heading. Edge sentences are embedded and searched by the [[sidecar]]; the plugin itself never embeds.

## Vector index

The sidecar keeps chunk and edge-sentence vectors per note in its data directory and answers node and edge search over REST and MCP, optionally followed by a graph query.

`VectorIndex` (`packages/sidecar/src/vectors/vector-index.mts`) re-indexes a note when its content hash, labels, properties or edge endpoints change (edges into a changed note are re-verbalized too), reuses any vector whose embedded text is unchanged (so folder moves re-embed nothing), records the model identity, blocks writes on a mismatch until `POST /vectors/rebuild`, and queues notes as pending with retries while the provider is unreachable, leaving old vectors searchable.

`POST /search` and the MCP `vector_search` tool take `query`, `target` (`nodes` or `edges`), `k`, optional `types` and `mode` (`best` or `pooled`), and an optional `then` Cypher query run on either backend (`backend`) with the hit ids as `$hits`; the response carries both results. This follow-up is how vector search combines with traversal. Vectors live as JSON files under `vectors/` in the data directory rather than in LadybugDB because the native build's vector index needs a network-installed extension and the mirror is disposable; a brute-force cosine scan is fast at vault scale. The WASM build links that extension statically, so [[embedded-search]] plans to move vectors into the store. Status reports vector counts, state and model; `OBSIGRAPH_VECTORS=0` disables the index and search answers 503.

While the provider is unreachable a query cannot be embedded, so search and retrieve answer 503 saying embeddings are unavailable; old vectors stay on disk and changed notes stay pending until the provider returns.

On a model mismatch `Ops` (`packages/sidecar/src/ops.mts`) answers search and retrieve from the old index with `stale: true` and a notice naming both models when the dimensions are equal. When the query vector's dimension differs from the stored one it refuses with 503 asking for a rebuild, and no similarity score is computed.

