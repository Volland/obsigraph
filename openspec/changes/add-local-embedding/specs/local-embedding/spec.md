## Purpose

Defines the bundled local embedding runtime, its model presets, the model fingerprint, and how a graph store changes model without mixing vectors or losing search.

## ADDED Requirements

### Requirement: Bundled local runtime
The system SHALL provide an embedding runtime that runs BERT-family models in WebAssembly in Node and in a WebView, with no native binaries and no network once weights are present, and SHALL apply each model's pooling, normalization and query or passage prefix.

#### Scenario: Offline embedding
- **WHEN** the CLI embeds text with the `minilm-l6` preset on a machine without network
- **THEN** it returns one 384-dimension normalized vector per text

#### Scenario: Prefixes applied
- **WHEN** a query is embedded with the `e5-small-multi` preset
- **THEN** the text actually embedded starts with `query: `, and a passage with `passage: `

### Requirement: Model presets
The system SHALL offer the presets `minilm-l6`, `bge-small-en` and `e5-small-multi`, each declaring model, dimension, pooling, prefixes, weight size and languages, and SHALL accept custom models named `ollama/<model>` and `openai/<model>` on desktop and in the CLI.

#### Scenario: Unknown preset
- **WHEN** `TG_EMBED_MODEL=foo` is set and `tg reindex` runs
- **THEN** it exits 2 listing the valid presets and the custom model forms

### Requirement: CLI pre-bundles the default model
The CLI SHALL install the `minilm-l6` weights with the package and SHALL use them when no model is configured.

#### Scenario: Fresh install
- **WHEN** `tg search "typed edges"` runs in a fresh project with no environment settings
- **THEN** results are hybrid and no network request is made

### Requirement: Model fingerprint
The system SHALL identify an embedding model by a fingerprint derived from runtime, model, weights hash (or remote model name), dimension, pooling, normalization, prefixes, chunker version and text-template version, and SHALL treat two vectors as comparable only when their fingerprints are equal.

#### Scenario: Same dimension, different model
- **WHEN** a store was built with `minilm-l6` and `bge-small-en` is configured
- **THEN** their fingerprints differ even though both have 384 dimensions

#### Scenario: Chunker changed
- **WHEN** a release changes how notes are chunked
- **THEN** the fingerprint of every model changes

### Requirement: Stored fingerprint is authoritative
Search SHALL use the model recorded in the store; a different configured model SHALL NOT trigger re-embedding during search, and SHALL produce a notice naming both models and the command that switches.

#### Scenario: Configured model differs
- **WHEN** the store was built with `minilm-l6` and `TG_EMBED_MODEL=e5-small-multi` is set
- **THEN** `tg search` answers with `minilm-l6`, embeds nothing new for the other model, and says `run tg reindex --model e5-small-multi to switch`

### Requirement: Shadow build on model change
Switching model SHALL build a second store for the new fingerprint while the current store keeps answering searches with its own model, SHALL switch only when the new store is complete, SHALL then delete the old store, and SHALL resume an interrupted shadow build.

#### Scenario: Search during switch
- **WHEN** a switch to `e5-small-multi` is half done and the user searches
- **THEN** results come from the `minilm-l6` store and status shows the switch progress

#### Scenario: Interrupted switch
- **WHEN** the process is killed during a shadow build and `tg reindex --model e5-small-multi` runs again
- **THEN** it continues from the units already embedded

### Requirement: Probe before switching
Before a shadow build starts, the system SHALL embed one probe text with the new model and SHALL abort with the current store untouched when the probe fails.

#### Scenario: Rejected key
- **WHEN** `tg reindex --model openai/text-embedding-3-small` runs with a rejected key
- **THEN** it exits 1 saying the key was rejected, and search still uses the old store

### Requirement: Embedding queue
The vector phase SHALL embed only units whose text hash has no vector, SHALL look each up in the vector pack first, SHALL embed the rest in batches that yield between batches, SHALL report progress, and in the CLI SHALL complete before `tg search` answers unless `--no-embed` is given.

#### Scenario: CLI blocks on fresh changes
- **WHEN** 200 sections changed and `tg search q` runs
- **THEN** it embeds them with progress on stderr and then answers with hybrid results

#### Scenario: No-embed flag
- **WHEN** 200 sections changed and `tg search q --no-embed` runs
- **THEN** it answers immediately and reports 200 items waiting for embeddings
