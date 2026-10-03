# Obsigraph

An Obsidian plugin that turns your vault into a typed, labeled, signed property graph and lets you query it with openCypher.

Status: v0.2. Schema notes, edge-property embeds, the LadybugDB mirror, vector search and the RAG sidecar are planned under `openspec/changes/`.

## Install (development)

```bash
npm install
npm test
OBSIGRAPH_OUT="/path/to/vault/.obsidian/plugins/obsigraph" npm run build
```

Then enable **Obsigraph** under Settings → Community plugins.

## Writing edges

An edge is a line in a note body. The note is the source node.

```markdown
knows:: [[Bob]]
knows:: [[Carol]] {since: 2018, label: "met at conf"}
-distrusts:: [[Eve]]
- works_at:: [[Acme]], [[Initech]] {role: engineer}
```

- `type:: [[Target]]` is the same syntax Graph Link Types uses, so existing notes keep working.
- `{...}` holds optional properties: numbers, booleans, quoted or bare strings, and lists.
- A `-` prefix on the type makes the edge negative (sign -1). Without a prefix the sign is +1. `weight` is an ordinary property.
- `{id: "met-2020"}` pins an edge's ID. Otherwise the ID is `source#type#target#n`.
- Lines in fenced code blocks and frontmatter are ignored. Malformed property blocks keep the edge and show up as diagnostics.

## Embedding edge properties

```markdown
We met in {{edge: Alice -knows-> Bob . since}}.
{{edge: met-2020 . since}}
{{edge: met-2020}}
```

- Embeds work in both reading view and live preview, and update when the edge changes.
- The endpoint form (`Source -type-> Target`) or a pinned id finds the edge.
- `. property` shows one value. Without it, all properties show as a table.
- Put the sign before the type: `--distrusts->` matches only negative edges, `-+knows->` only positive ones, and `-knows->` either.
- An edge referenced by endpoints without a pinned `id` shows a diagnostic suggesting one. Two matching edges also show a diagnostic.

## Typing nodes

Every note is a node. Its labels come from frontmatter:

```yaml
---
type: [Person, Employee]
---
```

A link to a note that doesn't exist creates a stub node. It is shown faded, and queries see it with `n.stub = true`.

## Type schemas

A note directly in `Types/` (configurable) declares the type named by its title:

```markdown
---
schema:
  properties:
    status: {kind: text, default: active}
    born: {kind: date, required: true}
  edges: [knows, worksAt]
---
## Notes
```

- Kinds are `text`, `number`, `boolean`, `date` and `link`.
- `edges` lists the allowed outgoing edge types. Leaving it out allows every type.
- The body is the template for new notes.
- Validation is advisory. Missing required properties and disallowed edges show as issues in the status bar, and the **Show diagnostics** command lists them.
- **Create note from type** makes a note with `type`, the defaults and the template body. It never overwrites an existing note.
- **Create schema note** scaffolds a new type.

## Styling

Each attribute is resolved separately. The highest-precedence source that sets it wins:

1. **The block header:** `node.Person: color=red, shape=diamond` or `edge.knows: color=orange, line=dotted`.
2. **The schema note:** `visualization: {color, shape, icon, label}`, plus `edges: {knows: {color, line}}` inside it.
3. **Settings:** the type styles and edge styles JSON.
4. **Built-in defaults:** a stable color per type. Negative edges are dashed red.

Icons are Lucide names, for example `user`. `label` names a property to show instead of the note title. Invalid values are ignored and reported in diagnostics. Select a node or edge in the Graph view to see where each attribute came from.

## Querying in a note

````markdown
```graph-query
view: table
columns: who, since

MATCH (a:Person)-[r:knows]->(b)
WHERE r.since > 2019
RETURN a.title AS who, r.since AS since
ORDER BY since DESC
```
````

Header options, all optional:

| Option | Values | Effect |
|---|---|---|
| `view` | `auto` (default), `table`, `graph` | `auto` draws a graph when the result has nodes or relationships, and a table otherwise. |
| `columns` | comma-separated column names | Table columns to show, in that order. |
| `height` | 100–4000 | Graph height in pixels. |
| `node.<Type>` / `edge.<type>` | `attr=value, …` | Style overrides for this block only. |

Results refresh when notes change. Graphs with more elements than the configured limit fall back to a table.

## Supported openCypher

- **Clauses:** `MATCH` and `OPTIONAL MATCH` with `WHERE`, `WITH` (alias expressions with `AS`), `RETURN [DISTINCT]` (including `*`), `ORDER BY`, `SKIP`, `LIMIT`.
- **Patterns:** labels, inline property maps, `->`, `<-`, undirected `-`, type alternation `[:a|b]`, comma-separated patterns, variable-length `[:knows*1..3]`, and path variables `p = (a)-[*]->(b)`. Unbounded `*` stops at the **Maximum path depth** setting (default 10), and the result says so.
- **Expressions:** arithmetic, comparisons, `IN`, `STARTS WITH`, `ENDS WITH`, `CONTAINS`, `IS [NOT] NULL`, `AND`, `OR`, `XOR`, `NOT`, `$params`, and `n:Label`.
- **Functions:** `id`, `type`, `labels`, `keys`, `properties`, `startNode`, `endNode`, `length`, `nodes`, `relationships`, string, number and list helpers, `size`, `coalesce`, and conversions.
- **Aggregates:** `count` (including `count(*)`), `sum`, `avg`, `min`, `max` and `collect`, each optionally with `DISTINCT`. Grouping works as in openCypher.
- **Built-in properties:** `n.stub`, `n.title`, `n.path`, `r.id`, `r.sign`.

Queries are read-only. `CREATE`, `SET`, `DELETE`, `MERGE` and `REMOVE` are rejected. `UNWIND`, `UNION`, `CALL`, `CASE`, `=~`, list slicing and `shortestPath` fail with an error that names them.

## Graph view

Run **Obsigraph: Open graph view** from the command palette or the ribbon icon.

- With an empty query, the view shows the active note's neighborhood and follows the note you open.
- Enter a query and press Run (or Cmd/Ctrl+Enter) to explore its result.
- Right-click or long-press a node to expand its neighbors.
- Double-click or Cmd/Ctrl-click a node to open its note.
- Select a node or edge to see its type, sign, ID and properties.

## Sidecar (headless service)

`packages/sidecar` serves a vault over REST without Obsidian running. It watches the folder and never writes to it.

```bash
npm run build:sidecar
OBSIGRAPH_VAULT=/path/to/vault OBSIGRAPH_DATA=/path/to/data OBSIGRAPH_TOKEN=change-me \
  node packages/sidecar/dist/server.mjs
curl -H 'authorization: Bearer change-me' -d '{"query":"MATCH (n:Person) RETURN n.title"}' localhost:8765/query
```

- **Endpoints:** `GET /health` (no token), `GET /status`, and `POST /query` with `{query, params}`. Results use the same `{columns, rows}` shape as the plugin.
- **Docker:** `packages/sidecar/Dockerfile` plus `compose.example.yaml`. The vault is mounted `:ro`, the image runs as a non-root user, the port is published on host loopback, and the token is passed as a Docker secret.
- **Environment:**
  - `OBSIGRAPH_VAULT` and `OBSIGRAPH_DATA` set the vault and data directories.
  - `OBSIGRAPH_TOKEN` or `OBSIGRAPH_TOKEN_FILE` set the token.
  - `OBSIGRAPH_HOST` (default `127.0.0.1`) and `OBSIGRAPH_PORT` (default `8765`) set the address.
  - `OBSIGRAPH_POLL_MS` enables polling, which bind mounts on macOS need.
  - `OBSIGRAPH_LADYBUG=0` turns off the LadybugDB mirror. It's on by default and runs when `@ladybugdb/core` is installed.
  - `OBSIGRAPH_DEBOUNCE_MS`, `OBSIGRAPH_QUERY_TIMEOUT_MS`, `OBSIGRAPH_MAX_BODY_BYTES`, `OBSIGRAPH_MAX_PATH_DEPTH` and `OBSIGRAPH_SCHEMA_FOLDER` tune the rest.

## Settings

- **Maximum graph elements:** above this many nodes plus edges, results show as a table.
- **Maximum path depth:** where unbounded variable-length patterns stop.
- **Refresh delay:** the debounce, in milliseconds, before blocks re-run after a vault change.
- **Type styles:** JSON keyed by type label, e.g. `{"Person": {"color": "#59a14f", "shape": "round-rectangle"}}`.
