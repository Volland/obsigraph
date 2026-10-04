---
lat:
  require-code-mention: true
---
# Example Vault Tests

Test specifications that keep the demo vault in `example/` honest: every query, embed and deliberate mistake behaves as its manual says. See [[publishing#Example vault]].

## Every guide query runs

Each `graph-query` block outside the diagnostics playground parses without header errors, uses the built-in engine, returns at least one row and gets a render plan.

## Playground queries fail clearly

The two broken queries in the diagnostics playground both raise errors, and the write query is rejected as read-only.

## Embeds resolve

Every `{{edge: ...}}` embed outside code resolves to a value or table, except the one embed the playground deliberately points at a missing edge.

## Deliberate diagnostics only

Schema validation flags only Dave (missing role) and Mallory (disallowed edge), syntax diagnostics come only from the playground, and the stubs are exactly Eve, Globex and Property Graphs 101.
