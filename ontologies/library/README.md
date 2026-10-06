# Library ontology

Book management: what you own, what you are reading and what you want to read, with authors, series, genres and saved quotes. Open this folder as an Obsidian vault with the Typed Graph plugin, or copy `Types/` into your own vault.

- **Types:** `Book` (status, format, rating, dates), `Author`, `Series`, `Genre`, `Quote`.
- **Edges:** `written_by`, `in_series` (with `volume`), `has_genre`, `sequel_of`, `inspired_by`, `influenced`, `quoted_from`.
- **Questions:** what am I reading? Which series have I started and not finished? Which authors do I rate highest?

```cypher
MATCH (b:Book {status: "reading"}) RETURN b.title, b.started ORDER BY b.started
```

`Examples/` has a few books so the graph is not empty on first open; delete them when you start.
