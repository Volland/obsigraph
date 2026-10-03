## 1. Provider interface

- [ ] 1.1 Define the embedding provider interface with batch embed and identity in `packages/core`
- [ ] 1.2 Implement batching with configurable batch size and bounded concurrency
- [ ] 1.3 Implement the model-identity mismatch check

## 2. Providers

- [ ] 2.1 Implement the Ollama provider with `nomic-embed-text` at `localhost:11434` as default
- [ ] 2.2 Implement the OpenAI-compatible provider (base URL, model, optional key)
- [ ] 2.3 Map unreachable, missing-model and malformed-response cases to actionable errors

## 3. Configuration

- [ ] 3.1 Add provider settings to the plugin and ensure keys are never written to notes
- [ ] 3.2 Add environment-based configuration reusable by the sidecar

## 4. Tests

- [ ] 4.1 Write tests with a fake HTTP server covering every scenario in the embedding-provider spec

## 5. Sync

- [ ] 5.1 Update lat.md/vector-search, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
