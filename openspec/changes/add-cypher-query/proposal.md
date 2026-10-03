## Why

Users want to query the vault graph in openCypher. A small read-only subset, with a stable result contract, proves the query path before heavier backends exist. See lat.md/query-engine.

## What Changes

- Add a lexer, recursive-descent parser and executor for `MATCH`, `WHERE`, `RETURN`, `ORDER BY`, `LIMIT`.
- Expose `r.sign`, `r.id` and `n.stub`.
- Reject write clauses; report unsupported clauses by name and syntax errors with position.
- Return `{columns: {name, kind}[], rows}` where values are nodes, relationships or scalars.

## Capabilities

### New Capabilities
- `cypher-query`: Read-only openCypher subset executed against the graph model.

### Modified Capabilities

## Impact

- New query module in `packages/core` and tests. Depends on `graph-model`. No UI.
