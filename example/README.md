# Typed Graph demo vault

A small Obsidian vault that uses every feature of [Typed Graph](https://volland.github.io/obsigraph/): typed nodes, typed and signed edges with properties, pinned ids, stubs, schema notes, styling, edge embeds, diagnostics and live openCypher blocks. It includes a step-by-step manual.

## Open it

1. In Obsidian, choose *Open another vault → Open folder as vault* and pick this `example` folder.
2. Install the plugin. If you downloaded `typed-graph-demo-vault.zip` from a release, it is already installed. Otherwise either:
   - from the repository root, run `npm install && npm run example:install`, which builds the plugin into `example/.obsidian/plugins/typed-graph/`, or
   - install **Typed Graph** from *Community plugins* ([open it in Obsidian](obsidian://show-plugin?id=typed-graph)).
3. Enable community plugins if Obsidian asks, then open **Start Here**.

## Contents

- `Start Here.md`: setup check, tour and things to try
- `Guide/How typed graphs work.md`: the model and the syntax
- `Guide/Cypher manual.md`: openCypher, step by step, with live examples
- `Guide/Query gallery.md`: block options, styling and recipes
- `Guide/Sidecar and agents.md`: LadybugDB, vector search, GraphRAG and MCP
- `Sandbox/`: deliberate mistakes and a scratch note
- `Types/`, `People/`, `Companies/`, `Projects/`, `Papers/`, `Topics/`: the data

Every query in the vault is run by the test suite (`packages/plugin/test/example-vault.test.ts`), so the manual stays correct as the plugin changes.
