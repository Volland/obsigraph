# Query gallery

A `graph-query` block can start with a **header**: `key: value` lines, then a blank line, then the query.

| Option | Values |
|---|---|
| `view` | `auto` (default), `graph`, `table` |
| `columns` | Table columns to show, in order |
| `height` | Graph height in pixels, 100 to 4000 |
| `backend` | `builtin` (default) or `ladybug` (needs the sidecar) |
| `node.<Label>` | Node style for this block: `color`, `shape`, `icon`, `label` |
| `edge.<type>` | Edge style for this block: `color`, `line` |

Shapes: `ellipse`, `rectangle`, `round-rectangle`, `diamond`, `hexagon`, `triangle`, `star`. Lines: `solid`, `dashed`, `dotted`. Icons are Lucide names.

## The whole lab

```graph-query
height: 520

MATCH (a)-[r]->(b)
RETURN a, r, b
```

## Force a table

`view: table` shows nodes and relationships as rows. `columns` picks and orders the columns:

```graph-query
view: table
columns: project, status, funded_by

MATCH (p:Project)
OPTIONAL MATCH (c:Company)-[:funds]->(p)
RETURN p.title AS project, p.status AS status, collect(c.title) AS funded_by, p.started AS started
```

## Force a graph

`view: graph` draws whatever nodes and relationships the result contains:

```graph-query
view: graph
height: 300

MATCH (p:Paper)-[r:cites]->(q)
RETURN p, r, q
```

## Restyle one block

Header styles override schema notes and settings, only in this block:

```graph-query
node.Engineer: color=#e5484d, shape=star
node.Project: color=#30a46c, shape=round-rectangle, icon=rocket
edge.contributes: color=#e5484d, line=dashed

MATCH (e:Engineer)-[r:contributes]->(p:Project)
OPTIONAL MATCH (p)-[d:depends_on]->(q)
RETURN e, r, p, d, q
```

Show a property instead of the title with `label`:

```graph-query
node.Person: label=role
node.Company: label=city

MATCH (p:Person)-[w:works_at]->(c:Company)
RETURN p, w, c
```

## Recipes

### Ego network

Everything one hop around a note, in both directions:

```graph-query
MATCH (a {title: "Carol"})-[r]-(b)
RETURN a, r, b
```

### Trust network

```graph-query
edge.trusts: color=#30a46c

MATCH (a:Person)-[r:trusts|distrusts]->(b)
RETURN a, r, b
```

### Funding chain

```graph-query
MATCH p = (c:Company)-[:funds]->(:Project)-[:depends_on*0..2]->(:Project)
RETURN p
```

### Research map

Papers, their topics and the topic hierarchy:

```graph-query
MATCH (paper:Paper)-[a:about]->(t:Topic)
OPTIONAL MATCH (t)-[b:broader]->(root)
RETURN paper, a, t, b, root
```

### Who to ask about a topic

```graph-query
view: table

MATCH (t:Topic)<-[:interested_in|about]-(x)
OPTIONAL MATCH (person:Person)-[:contributes|authored|leads]->(x)
WITH t, collect(DISTINCT coalesce(person.title, x.title)) AS who
RETURN t.title AS topic, who
ORDER BY topic
```

### Busiest people

```graph-query
view: table

MATCH (p:Person)-[r]->()
RETURN p.title AS person, count(r) AS edges, collect(DISTINCT type(r)) AS kinds
ORDER BY edges DESC
LIMIT 3
```

### Recently joined

```graph-query
view: table

MATCH (p:Person)
WHERE p.joined >= "2021-01-01"
RETURN p.title AS person, p.joined AS joined
ORDER BY joined DESC
```

## Settings that affect blocks

- *Max elements*: above this many nodes and edges, a graph result falls back to a table.
- *Max path depth*: the cap for open-ended `*` paths.
- *Type styles* / *Edge styles*: vault-wide styles, below schema notes in priority.
- *Default backend*: `builtin` or `ladybug`.

Next: [[Sidecar and agents]].
