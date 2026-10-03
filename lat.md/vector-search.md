# Vector Search

Semantic search over nodes and edges, stored in Ladybug's vector index so it can be combined with graph traversal in Cypher.

## Embedding provider

Embeddings come from a pluggable provider, defaulting to a local Ollama `nomic-embed-text` (768 dimensions) at localhost:11434, with any OpenAI-compatible endpoint also accepted.

The model name and dimension are stored with the index; a mismatch triggers a rebuild prompt instead of mixing vectors. Hosted-only is rejected as a default because it sends the vault to a third party.

Implemented by [[packages/sidecar/src/vectors/provider.ts#OllamaProvider]] (`/api/embed`) and [[packages/sidecar/src/vectors/provider.ts#OpenAIProvider]] (`/embeddings`), both batching with bounded concurrency while keeping input order, configured on the sidecar through `OBSIGRAPH_EMBED_PROVIDER`, `OBSIGRAPH_EMBED_URL`, `OBSIGRAPH_EMBED_MODEL`, `OBSIGRAPH_EMBED_KEY` or `OBSIGRAPH_EMBED_KEY_FILE` and `OBSIGRAPH_EMBED_BATCH`. Errors name the endpoint or model, and a missing Ollama model is never pulled automatically. [[packages/sidecar/src/vectors/provider.ts#identityMismatch]] guards the index. The plugin itself never embeds; vectors live with the sidecar.

## Node chunks

Each note is chunked, with its title, type labels and frontmatter prepended to every chunk so a chunk carries its own context.

A node's score is its best-matching chunk, or the pooled vector of its chunks.

[[packages/core/src/embed/chunk.ts#chunkNote]] splits by heading, then packs paragraphs, sentences and words under a character limit (default 1500, context included); the stored body is returned in citations while the embedded text carries the context. Chunk ids hash path, heading path, ordinal and body with a pure-JS hash, so unchanged chunks keep their ids. [[packages/core/src/embed/chunk.ts#nodeScore]] implements both scoring modes.

## Edge verbalization

Edges have no prose, so each is rendered as a sentence from its triple, labels and properties and that sentence is embedded.

Example: `Alice (Person) knows Bob (Person) - since 2020, met at conf`. This makes edges searchable by meaning. [[packages/core/src/embed/chunk.ts#verbalizeEdge]] turns `worksAt` or `works_at` into `works at`, appends `(negative)` for sign -1, shows `label` bare and other properties as `key value`, omits the pinned id, and records edge id, source path and heading. Because the index lives in Ladybug, vector search is desktop-only until the [[sidecar]] hosts it.

## Vector index

The sidecar keeps chunk and edge-sentence vectors per note in its data directory and answers node and edge search over REST, optionally followed by a graph query.

[[packages/sidecar/src/vectors/vector-index.ts#VectorIndex]] re-indexes a note when its content hash, labels, properties or edge endpoints change (edges into a changed note are re-verbalized too), reuses any vector whose embedded text is unchanged (so folder moves re-embed nothing), records the model identity, blocks writes on a mismatch until `POST /vectors/rebuild`, and queues notes as pending with retries while the provider is unreachable, leaving old vectors searchable.

`POST /search` takes `query`, `target` (`nodes` or `edges`), `k`, optional `types` and `mode` (`best` or `pooled`), and optional `then` Cypher run on either backend with the hit ids as `$hits` — this is how vector search combines with traversal. Vectors live in the data directory rather than in LadybugDB because Ladybug's vector index needs a network-installed extension and the mirror is disposable; a brute-force cosine scan is fast at vault scale. Status reports vector counts, state and model; `OBSIGRAPH_VECTORS=0` disables the index.

