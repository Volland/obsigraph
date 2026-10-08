---
lat:
  require-code-mention: true
---
# TG Search Tests

Test specifications for `tg search` and `tg reindex`: lexical ranking, optional hybrid ranking, key handling and the derived cache. See [[cli#Search]].

## Lexical default

Search with nothing configured.

### No configuration

With no environment settings `tg search` returns ranked sections without calling the network, which the test enforces with a fetch that throws.

### Title outranks body

A section titled with the query ranks above one that only mentions the words once in its body.

## Hybrid ranking

Search with an embedding provider.

### Provider configured

With a provider set, a query that shares no words with the answer ("login" against "sign in") finds it through vector rank fusion, which lexical search alone cannot.

### Provider down

When the provider fails, results stay lexical, a notice says embeddings were unavailable, and the exit code is 0.

## Key variable aliases

lat.md key variables keep working.

### Alias honored

With only `LAT_LLM_KEY` set, an OpenAI-compatible provider is used with that key as a bearer token.

### TG variables win over aliases

With `TG_EMBED_KEY_FILE` and `LAT_LLM_KEY` both set, the key from the file is used, because every `TG_EMBED_KEY*` variable is checked before any alias.

### Not written to disk

A key present during a search appears in no file under `.tg/`.

## Derived cache

The index is disposable.

### Cache deleted

Reindexing twice reuses unchanged vectors, and after deleting `.tg/` the next search works and recreates the cache.
