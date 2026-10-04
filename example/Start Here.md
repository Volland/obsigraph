# Typed Graph demo vault

This vault is a small research lab: five people, two companies, three projects, two papers and three topics, all connected by **typed, signed edges with properties**. Every feature of the Typed Graph plugin is used somewhere in it.

## Set up

1. Open this folder as a vault in Obsidian (*Open another vault → Open folder as vault*).
2. Install Typed Graph: [open it in Obsidian](obsidian://show-plugin?id=typed-graph) and click *Install*, or go to *Settings → Community plugins → Browse → "Typed Graph"*. If you cloned the repository, run `npm run example:install` to build the plugin straight into this vault.
3. Turn the plugin on, then reopen this note.

The graph below is live. If you see a graph, the plugin works:

```graph-query
height: 420

MATCH (a)-[r]->(b)
RETURN a, r, b
```

## Tour

Read these in order:

1. [[How typed graphs work]]: nodes, labels, edges, signs, properties, ids, stubs, schema notes, styling and embeds.
2. [[Cypher manual]]: a hands-on openCypher course where every example runs live.
3. [[Query gallery]]: block options (`view`, `columns`, `height`, per-block styles) and recipes.
4. [[Sidecar and agents]]: the optional service for LadybugDB, vector search, GraphRAG and MCP.
5. [[Diagnostics playground]]: deliberate mistakes, so you can see how the plugin reports them.

## Things to try

- Run **Typed Graph: Open graph view** (or click the ribbon icon), then open [[Alice]]. The view follows the active note. Right-click a node to expand it; double-click to open it.
- Open [[Alice]] in reading view to see edge embeds such as `{{edge: alice-knows-bob . since}}` turn into values.
- Run **Typed Graph: Show diagnostics** to see the warnings for [[Dave]] and [[Mallory]].
- Run **Typed Graph: Create note from type** and pick `Person` to get a note from the [[Person]] template.
- Change `since` on Alice's `knows:: [[Bob]]` line and watch every block and embed update.

## Layout

| Folder | Contents |
|---|---|
| `Types/` | Schema notes: properties, allowed edges, look, template |
| `People/`, `Companies/`, `Projects/`, `Papers/`, `Topics/` | The data |
| `Guide/` | The manual you are reading |
| `Sandbox/` | Places to experiment and break things |
