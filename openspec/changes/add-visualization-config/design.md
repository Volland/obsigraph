## Context

Styles are generated into Cytoscape style sheets from type definitions. Until now the only source is plugin settings. Schema notes (previous change) add a vault-synced source, and block headers add a per-query source. lat.md left the precedence open.

## Goals / Non-Goals

**Goals:** one deterministic precedence rule; per-type and per-edge-type attributes; live updates.

**Non-Goals:** a visual style editor, theming of the surrounding UI, conditional styling by property value (future).

## Decisions

**Precedence: block header > schema note > plugin settings > built-in default, per attribute.** Most specific wins: a block is the narrowest scope, a schema is vault-wide for a type, settings are device-local fallbacks. Alternative, schema note above block, was rejected because authors need a one-off override in a single query. Alternative, settings above schema, was rejected because settings do not sync and would make the same vault look different per device.

**Resolution is per attribute, not per type.** Allows a schema to set only a shape while settings supply color. Whole-type replacement was rejected as surprising.

**Resolution is a pure function in `core`** taking the three sources and returning a style map, tested without Cytoscape.

**Invalid values fall through with a diagnostic** rather than failing the render.

## Risks / Trade-offs

- [Per-attribute merging can be hard to debug] -> a details panel line in the Graph view shows which source supplied each attribute.
- [Icons unavailable on some platforms] -> fall back to shape only.
- [Header grows complex] -> only type-scoped style entries are supported now.
