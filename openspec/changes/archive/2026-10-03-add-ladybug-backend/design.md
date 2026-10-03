## Context

The query-block pipeline already takes a backend-agnostic result. The mirror (add-ladybug-mirror) holds the graph in LadybugDB. This change adds the second engine and a way to select it. See lat.md/query-engine#Two backends.

## Goals / Non-Goals

**Goals:** same result contract, full Cypher for reads, strict read-only, explicit selection, no silent fallback.

**Non-Goals:** writes, algorithms or vector queries as dedicated features (later), automatic backend choice by query analysis, mobile.

## Decisions

**Common `QueryBackend` interface returning the shared result contract.** The block pipeline depends only on the interface; engine choice is a lookup. Alternative: separate code paths in the block, rejected because it would duplicate rendering decisions.

**Selection: header `backend` then plugin setting, no auto-routing.** Explicit and predictable. Alternative: try built-in first and fall back to Ladybug on "unsupported", rejected because it hides which engine produced the result and masks divergences.

**Read-only enforced by the system with a tokenizing check before execution, plus a read-only database open if the API allows it.** The check tokenizes the query, ignoring strings and comments, and rejects write keywords, multiple statements, and non-read statement kinds. Alternative: rely on the database, rejected because read-only guarantees are unverified. A false rejection is acceptable; a false acceptance is not, so the check is allow-list oriented: only statements beginning with read clauses pass.

**Query translation for the generic storage model lives in the backend.** Label predicates and property access (`n.title`, `r.since`, `r.sign`) are rewritten onto the mirror's layout. Translating arbitrary Cypher is the main risk; alternatives are per-label tables in the mirror (see mirror design) or exposing the raw layout to users. Decision: start with translation covering the in-plugin subset plus label and property access, and treat gaps as documented divergences in add-engine-conformance. Assumption, unverified.

**Result mapping converts database values to graph-model node and relationship values** so renderers and links to notes keep working, with node identity by path.

**Backend availability is an explicit state (available, unavailable with reason, not ready)** shared with mirror status, driving the in-block messages.

## Risks / Trade-offs

- [Translation layer cannot cover full Cypher] -> clear error on untranslatable constructs; revisit mirror schema.
- [Write check bypass] -> allow-list approach, tests with adversarial queries, read-only open when available.
- [Stale reads] -> wait for pending sync or flag staleness.
- [Result type differences (integers, nulls, lists)] -> normalization in the mapper, verified by add-engine-conformance.
