# tg-search Specification

## Purpose
Defines section search that works with no configuration and improves when an embedding provider is available.

## Requirements

### Requirement: Lexical default
The system SHALL rank sections by lexical relevance over title, leading paragraph and body when no embedding provider is configured, without network access.

#### Scenario: No configuration
- **WHEN** `tg search "typed edges"` runs with no keys set
- **THEN** it returns ranked sections and does not contact any network service

#### Scenario: Title outranks body
- **WHEN** one section is titled "Edge Syntax" and another mentions the words once in its body
- **THEN** the titled section ranks first for "edge syntax"

### Requirement: Hybrid ranking
The system SHALL combine lexical and vector ranks when an embedding provider is configured, and SHALL fall back to lexical results with a notice when the provider fails.

#### Scenario: Provider configured
- **WHEN** an embedding provider is configured and reachable
- **THEN** results are ranked by fused lexical and vector ranks

#### Scenario: Provider down
- **WHEN** the provider times out
- **THEN** results are lexical and a notice says embeddings were unavailable, with exit code 0

### Requirement: Key variable aliases
The system SHALL read `LAT_LLM_KEY`, `LAT_LLM_KEY_FILE` and `LAT_LLM_KEY_HELPER` as aliases of the tg variables, preferring the tg ones, and SHALL never persist a key.

#### Scenario: Alias honored
- **WHEN** only `LAT_LLM_KEY` is set
- **THEN** it is used as the provider key

#### Scenario: Not written to disk
- **WHEN** a search runs with a key set
- **THEN** no file in `.tg/` contains the key

### Requirement: Derived cache
The system SHALL keep search state only in a rebuildable cache under `.tg/` and SHALL rebuild it with `tg reindex`.

#### Scenario: Cache deleted
- **WHEN** `.tg/` is removed
- **THEN** the next search works and recreates it
