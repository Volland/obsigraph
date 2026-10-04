## Context

Markdown is the only source of truth; everything else is derived. A whole-repo symbol graph can reach tens of thousands of nodes against a roughly 5-10k comfortable limit in the renderer.

## Goals / Non-Goals

**Goals:** code visible and queryable on demand; default safe for large repos; no vault writes.

**Non-Goals:** call graphs or dataflow, editing code from the graph, auto-generated vault notes.

## Decisions

**Annotated-only by default.** Only symbols carrying an annotation, plus their files, become nodes. `all` is explicit and subject to the element cap.

**Code nodes are first-class labeled nodes** (`CodeFile`, `CodeSymbol`) with properties `path`, `lang`, `kind`, `lines`, so no new query machinery is needed.

**Keys are `path#name path`**, the same as link targets, so link resolution and node identity agree and a code link never makes a stub.

**Toggle, not a second view.** The same renderer shows code nodes when the toggle or `code:` header is on.

**Plugin scans on demand** with the regex provider (no WASM), at the configured code root, and re-scans on file change events.

## Risks / Trade-offs

- [Large repos in `all` mode] -> cap with table fallback and a visible count notice.
- [Rename of a symbol breaks keys] -> annotation targets are re-resolved each scan; broken ones become diagnostics.
