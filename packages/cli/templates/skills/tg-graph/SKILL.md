---
name: tg-graph
description: Query the lat.md section graph with openCypher through tg. Use when you need relationships between sections, such as what links to what, what is nested where, or which sections nothing references.
---

# Querying the section graph

`tg cypher "<query>"` runs read-only openCypher over the documentation graph. The same query is available to MCP clients as the `tg_cypher` tool.

## Model

- Nodes: label `Section`, properties `section` (the lat id), `title`, `file`, `depth`, `startLine`, `endLine`, `summary`.
- Edges: `contains` (parent section to child section) and `references` (a wiki link that resolves to a section).
- Edge properties: `r.sign` (+1 or -1) and `r.id`.

## Examples

```cypher
// Sections nothing links to
MATCH (s:Section) WHERE NOT ()-[:references]->(s) RETURN s.section LIMIT 20

// Who references the Packaging section
MATCH (a:Section)-[:references]->(b:Section {title: "Packaging"}) RETURN a.section, b.file

// Biggest hubs
MATCH (s:Section)<-[r:references]-() RETURN s.section, count(r) AS n ORDER BY n DESC LIMIT 10
```

## Typed code edges

`tg edges --type implements` lists `@tg:` annotation edges (code to section) with their properties, signs and sources.

## Limits

Supported: MATCH, OPTIONAL MATCH, WITH, RETURN, ORDER BY, SKIP, LIMIT, aggregation and variable-length paths. Write clauses are rejected.
