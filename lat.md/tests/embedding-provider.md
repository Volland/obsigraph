---
lat:
  require-code-mention: true
---
# Embedding Provider Tests

Test specifications for the embedding providers described in [[vector-search#Embedding provider]], run against fake HTTP servers plus one real local Ollama call.

## Local Ollama by default

With no configuration the provider is Ollama at `localhost:11434` with `nomic-embed-text`, posting to `/api/embed` and returning 768-dimension vectors.

## Never hosted by default

A fresh configuration sends embedding requests only to localhost.

## OpenAI-compatible endpoint

A configured base URL, model and key are used for `/embeddings`, and vectors come back in input order even when the server reorders them.

## Batches keep order

Texts split across batches with bounded concurrency still return one vector per text in input order.

## Unreachable endpoint named

A refused connection fails with an error naming the endpoint.

## Missing model explained

A missing model fails naming the model and the install command, and nothing is pulled; malformed responses fail as such.

## Empty and uneven vectors rejected

A response with empty vectors or vectors of different lengths fails as `bad-response` naming the endpoint, so nothing is stored.

## Unresponsive endpoint times out

A request the endpoint never answers fails as `unreachable` after the configured timeout (`OBSIGRAPH_EMBED_TIMEOUT_MS`), naming the endpoint.

## Identity reported

The provider reports its kind, model and vector dimension.

## Model change detected

A different model or dimension than the stored one is a mismatch that asks for a rebuild; the same identity is not.

## Key from environment only

API keys come from the environment or a key file, and invalid provider settings fail clearly.

## Real Ollama round trip

When local Ollama is running, two texts embed into two 768-dimension vectors.
