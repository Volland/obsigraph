## ADDED Requirements

### Requirement: Provider selection
The system SHALL select the embedding provider for `tg search` from `TG_EMBED_PROVIDER` (`ollama`, `openai` or `none`), with `TG_EMBED_URL` and `TG_EMBED_MODEL` overrides; with no provider set and a key present it SHALL use an OpenAI-compatible provider, choosing the Vercel AI Gateway defaults for a `vck_` key; with neither set it SHALL search lexically and touch no network.

#### Scenario: Nothing configured
- **WHEN** no `TG_EMBED_*` or `LAT_LLM_KEY*` variable is set and `tg search login` runs
- **THEN** results are lexical and no network request is made

#### Scenario: Disabled explicitly
- **WHEN** `TG_EMBED_PROVIDER=none` and `LAT_LLM_KEY` are both set
- **THEN** search is lexical only

### Requirement: Search output
`tg search <query> [--limit N] [--lexical]` SHALL return at most N hits (default 5), SHALL skip embeddings with `--lexical`, and with `--json` SHALL print one JSON document holding `mode` (`lexical` or `hybrid`), any notice, the query and ranked hits with section id, score, file and line range.

#### Scenario: JSON output
- **WHEN** `tg search login --json --lexical` runs
- **THEN** stdout is one JSON document with `mode` `lexical` and up to five hits each giving id, score, file and line range
