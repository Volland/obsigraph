## MODIFIED Requirements

### Requirement: Secrets stay out of the vault
The system SHALL NOT write API keys or provider credentials into vault notes, into the index or anywhere in the data directory. The Obsidian plugin never embeds; keys are given to the sidecar through `OBSIGRAPH_EMBED_KEY` or `OBSIGRAPH_EMBED_KEY_FILE` and to the CLI through environment variables.

#### Scenario: Key configured
- **WHEN** the sidecar starts with `OBSIGRAPH_EMBED_KEY` set and indexes the vault
- **THEN** no file in the vault or the data directory contains the key

## ADDED Requirements

### Requirement: Provider selection from the environment
The sidecar SHALL select the embedding provider from `OBSIGRAPH_EMBED_PROVIDER` (`ollama`, the default, or `openai`), with `OBSIGRAPH_EMBED_URL`, `OBSIGRAPH_EMBED_MODEL` and `OBSIGRAPH_EMBED_BATCH` overrides, SHALL require `OBSIGRAPH_EMBED_URL` for `openai`, and SHALL fail to start with an error naming the accepted values for any other provider.

#### Scenario: Unknown provider
- **WHEN** the sidecar starts with `OBSIGRAPH_EMBED_PROVIDER=cohere`
- **THEN** it fails with an error saying the provider is unknown and that `ollama` or `openai` is expected

### Requirement: Rejected key reported
When the endpoint answers HTTP 401 or 403, the system SHALL fail the embedding call with an error naming the endpoint and saying the API key was rejected, and SHALL store no vectors.

#### Scenario: Wrong key
- **WHEN** an OpenAI-compatible endpoint answers 401 to an embedding request
- **THEN** the error names the endpoint and says the key was rejected
