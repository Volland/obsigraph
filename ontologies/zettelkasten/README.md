# Zettelkasten ontology

Atomic notes, their sources and the topics that index them. Open this folder as an Obsidian vault with the Typed Graph plugin, or copy `Types/` into your own vault.

- **Types:** `Zettel` (stage: fleeting, literature, permanent), `Source`, `Topic`.
- **Edges:** `extends`, `supports`, `contradicts` (shown dashed red), `example_of`, `follows`, `cites`, `about`, `related_to`.
- **Questions:** which permanent notes cite nothing? Which zettels contradict another? Which topics have only seeds?

```cypher
MATCH (z:Zettel {stage: "permanent"}) OPTIONAL MATCH (z)-[r:cites]->(s:Source) WITH z, count(r) AS n WHERE n = 0 RETURN z.title
```

`Examples/` holds a few linked notes so the graph is not empty on first open; delete them when you start.
