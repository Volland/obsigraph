## Why

Semantic search needs vectors, and vectors must come from a model the user controls. A provider interface keeps the vault local by default and lets users opt into other endpoints. See lat.md/vector-search#Embedding provider.

## What Changes

- Add an embedding provider interface in `packages/core` that turns text batches into vectors and reports model name and dimension.
- Add a default provider for local Ollama (`nomic-embed-text`, 768 dimensions, `localhost:11434`) and a provider for any OpenAI-compatible endpoint.
- Record model name and dimension in index metadata and detect mismatches, so vectors from different models are never mixed.
- Settings and sidecar configuration select the provider; hosted endpoints are never the default.

## Scope note

The vector index lives in the sidecar (lat.md/ladybug-mirror, lat.md/sidecar), so the plugin never embeds: the provider is configured through sidecar environment variables only, and keys come from the environment or a key file, never notes or plugin data.

## Capabilities

### New Capabilities
- `embedding-provider`: Pluggable text embedding with a local default, OpenAI-compatible endpoints, and model identity checks.

### Modified Capabilities

## Impact

- New embedding module in `packages/core` plus provider settings in `packages/plugin`. No index yet; the mismatch check is exposed as a reusable function consumed by `add-vector-index`.
- Assumptions: the user's local Ollama already has `nomic-embed-text` pulled; if absent the provider reports a clear error rather than pulling it. OpenAI-compatible means the `/v1/embeddings` request and response shape. API keys come from settings or environment and are never written into the vault.
