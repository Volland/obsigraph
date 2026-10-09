## MODIFIED Requirements

### Requirement: Local default provider
The CLI, the plugin and the sidecar SHALL use the bundled local runtime with the `minilm-l6` preset as the default embedding model when none is configured.

#### Scenario: Default configuration
- **WHEN** no model is configured and the sidecar embeds text
- **THEN** the bundled runtime produces 384-dimension vectors with `minilm-l6` and no network request is made

#### Scenario: Default is never hosted
- **WHEN** the plugin, the CLI or the sidecar starts with a fresh configuration
- **THEN** no network request is sent to any non-local host for embedding

### Requirement: Provider selection from the environment
The sidecar SHALL select the embedding model from `OBSIGRAPH_EMBED_MODEL` (a preset id, `ollama/<model>` or `openai/<model>`), SHALL keep accepting `OBSIGRAPH_EMBED_PROVIDER` (`ollama` or `openai`) with `OBSIGRAPH_EMBED_URL`, `OBSIGRAPH_EMBED_MODEL` and `OBSIGRAPH_EMBED_BATCH` overrides as custom models, SHALL require `OBSIGRAPH_EMBED_URL` for `openai`, SHALL use the `minilm-l6` preset when nothing is set, and SHALL fail to start with an error naming the accepted values for any other provider or preset.

#### Scenario: Unknown provider
- **WHEN** the sidecar starts with `OBSIGRAPH_EMBED_PROVIDER=cohere`
- **THEN** it fails with an error saying the provider is unknown and that `ollama` or `openai` is expected

#### Scenario: Explicit Ollama kept
- **WHEN** the sidecar starts with `OBSIGRAPH_EMBED_PROVIDER=ollama` and no model
- **THEN** it embeds with Ollama `nomic-embed-text` as before
