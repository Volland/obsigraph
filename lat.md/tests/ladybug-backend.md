---
lat:
  require-code-mention: true
---
# Ladybug Backend Tests

Test specifications for `backend: ladybug` queries described in [[ladybug-mirror#Query translation]], run against a real sidecar and LadybugDB where available.

## Same columns and values

Translated queries return the same columns, kinds and `_type`-tagged values as the built-in engine across labels, typed properties, optional matches, `WITH`, aggregation, variable-length paths and empty patterns.

## Full Cypher for reads

Read syntax outside the built-in subset, such as `UNWIND`, runs on Ladybug untranslated with a notice.

## Writes rejected

Writes, writes after `WITH`, second statements, schema statements, `CALL` and `DETACH DELETE` are rejected as read-only and nothing changes.

## Keywords in strings allowed

Forbidden words inside strings, comments, property names and labels do not trigger the guard.

## Negative edges filter

`r.sign = -1` selects the same negative edges, with the same ids, as the built-in engine.

## Unknown backend rejected

A `backend` value other than builtin or ladybug is a 400 naming the allowed values.

## Unavailable and not ready

A sidecar with Ladybug disabled answers 503 `unavailable` with the reason; a mirror that has not finished building answers `not_ready`.

## Edit then query

As soon as the built-in engine sees a new edge, a Ladybug query includes it too, because reads wait for pending syncs.

## Stale results flagged

When syncs do not settle within the wait, the query still answers but carries a staleness notice.

## Errors with position

A malformed query is a syntax error with line and column.

## Backend selection

The block header picks the backend, the plugin default applies otherwise, and unknown values are header errors.

## Sidecar not configured or unreachable

A missing URL explains how to configure the sidecar; connection failures and rejected tokens are explained, not thrown.

## Ladybug unavailable on sidecar

When the sidecar reports Ladybug unavailable, the block shows the reason and how to enable it.

## Mirror rebuilding retries

A not-ready mirror turns into a retry after a short delay instead of an error.

## Remote errors keep position

Errors from the sidecar keep their line and column so the block can point into its query.

## Renderer unchanged

A Ladybug result from a real sidecar converts back into plugin values that render to the same graph plan as the built-in result.

## Constructs outside the subset pass through

A `COUNT {}` subquery, which the built-in engine names as unsupported, and list slicing it cannot parse both run untranslated on Ladybug with a notice.

## Failed sync is reported

When the mirror's last sync failed, a Ladybug query fails as `unavailable` naming the cause, whether or not an older snapshot exists, instead of `not_ready`.
