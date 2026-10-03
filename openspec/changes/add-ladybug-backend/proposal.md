## Why

The in-plugin engine supports only a Cypher subset. Users who need the full language for reads should be able to run the same query text on LadybugDB, choosing the engine per query. See lat.md/query-engine#Two backends.

## What Changes

- Add a Ladybug query backend behind the same query interface and `{columns:{name,kind}[], rows}` result contract as the in-plugin engine.
- Reject write clauses (`CREATE`, `SET`, `DELETE`, `MERGE`, `REMOVE`) and any other mutating or schema-changing statement before execution.
- Add a `backend` header option in `graph-query` blocks and a plugin-level default setting.
- Show a clear in-block error when Ladybug is unavailable (mobile, not installed, mirror not ready).
- Expose `r.sign`, `r.id`, `n.stub` identically to the in-plugin engine.

## Capabilities

### New Capabilities
- `ladybug-backend`: Read-only full-Cypher query execution on the mirror, selectable per query.

### Modified Capabilities

## Impact

- New backend module in `packages/plugin` with pure result-mapping and write-rejection logic in `packages/core`; settings and block header parsing gain one option. Depends on `add-ladybug-mirror`, `cypher-query`, `graph-query-block`.

## Assumptions

- Ladybug can run reads over the mirror's storage layout, possibly via query translation; not verified. Full-language support means whatever the installed Ladybug version supports; the spec does not enumerate functions.
- Ladybug offers no verified read-only connection mode in the Node API, so read-only is enforced by the system's own statement check (and by a read-only open if available) rather than assumed from the database.
- Mutating procedure calls and extension or schema statements (`CALL`, `COPY`, `INSTALL`, `LOAD`, `ATTACH`, DDL) are treated as non-read and rejected; whether read-only `CALL` procedures should be allowed is left for a later change.
