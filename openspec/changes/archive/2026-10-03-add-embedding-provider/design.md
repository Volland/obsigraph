## Context

Milestone v0.4 adds RAG. Embeddings are the first dependency of chunking, the vector index and the sidecar. `core` must stay free of Obsidian APIs so the sidecar can reuse it; HTTP is done with the platform `fetch`. Motivation: lat.md/vector-search.

## Goals / Non-Goals

**Goals:** one small interface, a private-by-default provider, safe handling of model changes.

**Non-Goals:** storing vectors (see add-vector-index), chunking, in-process models, automatic model pulling, rate-limit tuning beyond simple batching.

## Decisions

**Interface: `embed(texts) -> vectors` plus `identity() -> {model, dimension}`.** Alternative, a single-text method, was rejected because per-request overhead dominates indexing. Dimension is discovered from a probe embed when the provider cannot state it.

**Ollama default, OpenAI-compatible second.** Ollama keeps the vault on the machine and the user already runs it with `nomic-embed-text`. Many hosted and local servers speak the OpenAI embeddings shape, so one adapter covers them. Hosted-only default was rejected because it sends the vault to a third party.

**Mismatch is a pure check on stored identity.** The check compares model name and dimension and returns a result; the index change decides what to do. Auto-converting or truncating vectors was rejected as it silently degrades search.

**Batching with a configurable max batch size and bounded concurrency.** Default small enough for modest local hardware.

**Assumptions:** `nomic-embed-text` expects task prefixes for best quality; we embed passages and queries without prefixes in v0.4 and note it as a tuning item.

## Risks / Trade-offs

- [Ollama not running at plugin start] -> fail fast with a clear message; indexing resumes when available.
- [Same model name, different weights or quantization] -> not detectable; documented, user can force a rebuild.
- [API key leakage] -> keys live in settings or env only, never logged.
