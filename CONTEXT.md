# Typed Graph

Typed Graph turns markdown (an Obsidian vault or a `lat.md/` folder) into a typed, signed property graph that people and agents can query and search.

## Language

### Sources and derived stores

**Corpus**:
The set of markdown a host searches: the notes of a **Vault**, or the sections of a **Lattice**.
_Avoid_: dataset, collection

**Vault**:
An Obsidian folder of notes; its notes become graph nodes.

**Lattice**:
A `lat.md/` folder; its sections become graph nodes.
_Avoid_: docs folder, knowledge base

**Graph store**:
The embedded LadybugDB database a host keeps beside a **Corpus**, holding the graph, its vectors and its full-text index. Always derived from markdown and safe to delete.
_Avoid_: mirror (reserved for the sidecar's copy), cache, vector DB

**Mirror**:
The **Graph store** held by the sidecar, served over REST and MCP.

### Search

**Embedding model**:
The model that turns text into vectors for one **Graph store**; exactly one per store at a time.
_Avoid_: embedder, mBaring, encoder

**Model fingerprint**:
The identity of an **Embedding model** as it affects vectors; two vectors are comparable only when their fingerprints are equal.
_Avoid_: model name, label

**Card**:
The one embedded summary of a node: its title, types, key properties, leading paragraph and main outgoing edges. Answers "which thing".
_Avoid_: node embedding, pooled vector, profile

**Chunk**:
A piece of one section of a note or **Lattice** section, embedded with its title and heading path. Answers "where is it said". A node has one or more Chunks.
_Avoid_: passage, snippet, segment

**Fact**:
A typed edge reified as a searchable item, carrying the edge's sentence and pointing at its source and target nodes. Answers "which relationship". Untyped structural links (`contains`, `references`) never become Facts.
_Avoid_: edge vector, triple, statement

**Graph boost**:
The ranking bonus a search hit earns from being directly linked to other top hits, so related results rise together.
_Avoid_: PageRank, graph rerank

**Context pack**:
The result of a retrieve: cited **Chunks** and connecting **Facts** chosen to fit a text budget, for an agent to read. Distinct from a search result list, which is ranked nodes for a person to open.
_Avoid_: RAG result, context window, answer

**Shadow build**:
A second **Graph store** built in the background for a new **Model fingerprint** while the current one keeps answering searches; it replaces the current store only once complete.
_Avoid_: reindex (that is the command), migration

**Vector pack**:
A synced, append-only set of vectors keyed by the hash of their embedded text and grouped by **Model fingerprint**, letting devices reuse each other's embeddings. Never a database.
_Avoid_: vector cache, shared index

## Example dialogue

> **Dev:** If I delete `.tg/graph.lbug`, do I lose anything?
> **Domain expert:** No. The **Graph store** is derived from the **Lattice**; the next search rebuilds it, re-embedding with the same **Embedding model**.
> **Dev:** And the sidecar's database?
> **Domain expert:** That's the **Mirror** — also a **Graph store**, just hosted by the sidecar for a **Vault**.
