## Why

Linking code to docs only pays off if the links can be seen and queried. Code symbols should appear in the same graph as notes, without writing generated files into the vault or flooding the view.

## What Changes

- Derived `CodeFile` and `CodeSymbol` nodes in the in-memory graph, with edges from `@lat:` and `@tg:` annotations. Nothing is written into the vault.
- Setting `code: annotated | all | off` (default `off` in the plugin, `annotated` in the CLI); `annotated` creates nodes only for annotated symbols and the files holding them.
- Cypher can match `CodeFile`/`CodeSymbol` like any labeled node; the style system gives them default shapes and colors.
- Graph view and `graph-query` blocks get a Code toggle; element-cap fallback to a table applies.
- Decision: derived and opt-in; materialized stub notes only through explicit export.
- Assumption: the plugin gets a project root by mounting the vault at it, or an explicit "code folder" setting.

## Capabilities

### New Capabilities
- `code-layer`: Code nodes and edges in the graph, the setting that controls them, and their rendering.

### Modified Capabilities
- `graph-model`: nodes may be code nodes; stubs are unaffected.
- `visualization-config`: default styles for code node types.

## Impact

- `packages/core` graph builder and `Graph`; plugin settings, Graph view and block header; sidecar mirror schema (code nodes mirrored like any node).
- Depends on `add-tg-symbol-provider` and `add-tg-annotations`.
