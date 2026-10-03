## Context

The sidecar service already syncs a vault, holds the mirror and vector index, and serves authenticated REST. This change adds agent-facing interfaces on top. Motivation: lat.md/sidecar#Interfaces.

## Goals / Non-Goals

**Goals:** three focused MCP tools, a hybrid retrieve that yields citable context, same security posture as REST.

**Non-Goals:** write tools, reranking models, answer generation by an LLM in the sidecar, multi-hop agent planning, per-tool authorization scopes.

## Decisions

**Three tools: `cypher_query`, `vector_search`, `graphrag_retrieve`.** A small surface is easier for agents to use correctly. Alternative, many fine-grained tools (get_node, list_types), was rejected for v0.4; Cypher covers them.

**Streamable HTTP MCP on the existing listener, with a stdio launch mode.** Sharing the listener reuses token auth, bind address and limits. Stdio allows trivial local use. A separate port was rejected as a second surface to secure.

**Hybrid retrieve algorithm:** (1) embed question; (2) top-k over nodes and edges; (3) seed set = hit nodes plus both endpoints of hit edges; (4) expand by depth with per-node and total caps, ranking neighbors by the best similarity of their chunks to the question; (5) choose best-matching chunks per node; (6) return chunks ordered hits first then neighbors by distance, each with a citation and the connecting edges.
Alternative, pure vector top-k, ignores relationships. Alternative, LLM-driven expansion, adds latency and nondeterminism.

**Citations are structured data, not formatted prose** (path, heading, text, score, role, distance) so clients choose rendering.

**Security.** Same bearer token and bind rules as REST; tools are read-only by construction; Cypher write clauses rejected; output size capped so a hub node cannot exfiltrate the whole vault in one call. Tool input is validated against schemas. Retrieved note text is untrusted content to the agent and could contain prompt injection; the tool description states this and the response marks text as quoted vault content.

**Assumptions:** defaults k = 5, depth = 1, neighbor cap and chunk cap configurable.

## Risks / Trade-offs

- [Prompt injection from note text reaching an agent] -> label results as data, keep tools read-only, no tool that acts on content.
- [Hub nodes blow up context] -> caps and truncation flag.
- [MCP spec and SDK churn] -> keep the tool layer thin over shared functions also used by REST.
- [Retrieval quality depends on verbalization and chunking] -> evaluate on a fixture vault; tuning lives in earlier changes.
