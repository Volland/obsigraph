## MODIFIED Requirements

### Requirement: Lexical default
The system SHALL rank sections by lexical relevance over title, leading paragraph and body without network access when vectors are disabled with `TG_EMBED_PROVIDER=none` or `--mode lexical`, and SHALL otherwise search hybrid with the bundled model.

#### Scenario: No configuration
- **WHEN** `tg search "typed edges"` runs with no keys or model set
- **THEN** it returns hybrid-ranked sections using the bundled model and does not contact any network service

#### Scenario: Title outranks body
- **WHEN** one section is titled "Edge Syntax" and another mentions the words once in its body, and search is lexical
- **THEN** the titled section ranks first for "edge syntax"

### Requirement: Hybrid ranking
The system SHALL combine lexical and vector ranks whenever vectors are enabled, and SHALL fall back to lexical results with a notice when the model fails or its weights are missing.

#### Scenario: Provider configured
- **WHEN** a custom embedding provider is configured and reachable
- **THEN** results are ranked by fused lexical and vector ranks

#### Scenario: Bundled model
- **WHEN** no model is configured
- **THEN** results are ranked by fused lexical and vector ranks from the bundled model

#### Scenario: Provider down
- **WHEN** a configured custom provider times out
- **THEN** results are lexical and a notice says embeddings were unavailable, with exit code 0

### Requirement: Provider selection
The system SHALL select the model for `tg search` from `TG_EMBED_MODEL` (a preset id, `ollama/<model>` or `openai/<model>`), SHALL keep accepting `TG_EMBED_PROVIDER` (`ollama`, `openai` or `none`) with `TG_EMBED_URL` and `TG_EMBED_MODEL` overrides as custom models, SHALL use an OpenAI-compatible provider when only a key is present, choosing the Vercel AI Gateway defaults for a `vck_` key, and SHALL use the bundled `minilm-l6` preset when nothing is set. A configured model applies to a new store or through `tg reindex`; an existing store keeps its recorded model.

#### Scenario: Nothing configured
- **WHEN** no `TG_EMBED_*` or `LAT_LLM_KEY*` variable is set and `tg search login` runs
- **THEN** the bundled model is used and no network request is made

#### Scenario: Disabled explicitly
- **WHEN** `TG_EMBED_PROVIDER=none` and `LAT_LLM_KEY` are both set
- **THEN** search is lexical only

#### Scenario: Preset selected
- **WHEN** `TG_EMBED_MODEL=bge-small-en` is set and `tg reindex` runs
- **THEN** the store is rebuilt with `bge-small-en` through a shadow build
