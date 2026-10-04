# Sidecar and agents

The plugin works on its own. The **sidecar** is an optional Node service that reads a copy of this vault and serves the same graph to other programs. Your notes are never written to; everything it builds lives in a separate data directory.

It adds:

- **LadybugDB backend**: a real graph database mirror for the Cypher features the built-in engine lacks (`UNWIND`, `CASE`, `UNION`, regular expressions).
- **Vector search** over notes (split into chunks by heading) and over edges (turned into sentences like "Alice knows Bob - since 2020").
- **GraphRAG**: vector hits expanded along typed edges, returned with citations to note paths and headings.
- **MCP server** with the tools `cypher_query`, `vector_search` and `graphrag_retrieve`, so Claude and other agents can use the vault.

## Run it

Embeddings are local by default, through Ollama:

```bash
ollama pull nomic-embed-text
git clone https://github.com/Volland/obsigraph && cd obsigraph
npm install && npm run build:sidecar
mkdir -p ~/.typed-graph-demo
OBSIGRAPH_VAULT=./example OBSIGRAPH_DATA=~/.typed-graph-demo OBSIGRAPH_TOKEN=change-me \
  node packages/sidecar/dist/server.mjs
```

It listens on `127.0.0.1:8765`. The data directory must be outside the vault. In *Settings → Typed Graph*, set *Sidecar URL* to `http://127.0.0.1:8765` and *Sidecar token* to the token you chose.

## Use LadybugDB in a block

Add `backend: ladybug` to the header. The examples below are plain text so this note works without the sidecar; change the fence language to `graph-query` to run them.

Any query the built-in engine understands runs unchanged. The sidecar translates labels and properties for LadybugDB:

```cypher
backend: ladybug

MATCH (p:Person)-[c:contributes]->(proj:Project)
WHERE c.hours >= 100
RETURN p, c, proj
```

Queries that use syntax the built-in engine lacks (`CASE`, `UNWIND`, `=~`) are sent to LadybugDB **untranslated**. Write them against the mirror's layout:

- Every note is a `Node`.
- Labels are a list, tested with `list_contains(n.labels, "Person")`.
- Properties are typed columns named `p_<name>_<kind>`, where the kind is `s` for text, `n` for number, `b` for boolean, `ls`/`ln` for lists and `j` for anything else. For example, `role` becomes `p_role_s` and `hours` becomes `p_hours_n`.
- `title`, `path`, `stub` and `labels` keep their names.

```cypher
backend: ladybug
view: table

MATCH (p:Node)
WHERE list_contains(p.labels, "Person")
RETURN p.title AS name,
       CASE WHEN p.p_role_s IS NULL THEN "no role yet" ELSE p.p_role_s END AS role
ORDER BY name
```

```cypher
backend: ladybug
view: table

UNWIND ["Person", "Company", "Project"] AS label
MATCH (n:Node)
WHERE list_contains(n.labels, label)
RETURN label, count(n) AS nodes
```

```cypher
backend: ladybug
view: table

MATCH (p:Node)-[c:contributes]->(proj:Node)
RETURN p.title AS person, proj.title AS project,
       CASE WHEN c.p_hours_n >= 100 THEN "core" ELSE "helper" END AS involvement
ORDER BY person, project
```

## Ask over HTTP

```bash
TOKEN=change-me
curl -s -H "authorization: Bearer $TOKEN" localhost:8765/query \
  -d '{"query": "MATCH (p:Person)-[r:knows]->(q) RETURN p.title, q.title, r.since"}'
curl -s -H "authorization: Bearer $TOKEN" localhost:8765/search \
  -d '{"query": "who works on ranking?", "target": "nodes", "k": 5}'
curl -s -H "authorization: Bearer $TOKEN" localhost:8765/retrieve \
  -d '{"question": "what does Search depend on?", "k": 5, "depth": 1}'
```

## Connect an agent (MCP)

In stdio mode the sidecar speaks MCP directly and needs no token. For Claude Code:

```bash
claude mcp add typed-graph \
  -e OBSIGRAPH_VAULT=/path/to/obsigraph/example -e OBSIGRAPH_DATA=$HOME/.typed-graph-demo \
  -- node /path/to/obsigraph/packages/sidecar/dist/server.mjs --stdio
```

Then ask questions such as "Which projects does Acme fund, and who contributes to them?". The agent can answer with Cypher, vector search or GraphRAG.

See the [full documentation](https://volland.github.io/obsigraph/docs.html#sidecar) for every option.
