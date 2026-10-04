# Cypher manual

openCypher is a query language for property graphs. You draw the shape you are looking for with ASCII art, and the engine finds every place in the graph where it fits. Every example on this page is a live `graph-query` block: edit it and the result updates.

A block is a fenced code block with the language `graph-query`:

````markdown
```graph-query
MATCH (p:Person)
RETURN p
```
````

If the result contains nodes, relationships or paths it is drawn as a graph; otherwise it is shown as a table. Queries are **read-only**, so nothing you type here can change your notes.

## 1. Nodes: `MATCH` and `RETURN`

`(p)` is a node and `p` is a variable you choose. `:Person` restricts it to nodes with that label.

```graph-query
MATCH (p:Person)
RETURN p
```

Return properties instead of nodes to get a table. `AS` names a column:

```graph-query
MATCH (p:Person)
RETURN p.title AS name, p.role AS role, p.joined AS joined
ORDER BY name
```

A property map inside the pattern is a shortcut for equality:

```graph-query
view: table

MATCH (p:Project {status: "active"})
RETURN p.title AS project, p.started AS started
```

A node with several labels matches each of them. Use a label check in `WHERE` to require two:

```graph-query
view: table

MATCH (e:Engineer)
WHERE e:Person
RETURN e.title AS engineer, labels(e) AS labels, e.language AS language
```

## 2. Relationships

`-[r:knows]->` is a relationship of type `knows`, from left to right. `<-[...]-` points the other way, and `-[...]-` ignores direction.

```graph-query
MATCH (a:Person)-[r:knows]->(b:Person)
RETURN a, r, b
```

Who works at Acme? Here the arrow points into the company:

```graph-query
view: table

MATCH (c:Company {title: "Acme"})<-[w:works_at]-(p)
RETURN p.title AS person, w.role AS role, w.since AS since
ORDER BY since
```

Leave the type out to match any relationship, or list alternatives with `|`:

```graph-query
MATCH (a)-[r:trusts|distrusts]->(b)
RETURN a, r, b
```

Edge properties work exactly like node properties:

```graph-query
view: table

MATCH (p:Person)-[c:contributes]->(proj:Project)
RETURN p.title AS person, proj.title AS project, c.hours AS hours
ORDER BY hours DESC
```

## 3. Filtering with `WHERE`

`WHERE` supports comparisons (`=`, `<>`, `<`, `<=`, `>`, `>=`), `AND`, `OR`, `XOR`, `NOT`, `IN`, `STARTS WITH`, `ENDS WITH`, `CONTAINS` and `IS NULL` / `IS NOT NULL`.

```graph-query
view: table

MATCH (p:Person)-[c:contributes]->(proj)
WHERE c.hours >= 50 AND proj.status IN ["active", "research"]
RETURN p.title AS person, proj.title AS project, c.hours AS hours
```

Find notes that are missing a property:

```graph-query
view: table

MATCH (p:Person)
WHERE p.role IS NULL
RETURN p.title AS missing_role
```

Text matching is case-sensitive. Use `toLower` to ignore case:

```graph-query
view: table

MATCH (p:Paper)
WHERE toLower(p.title) CONTAINS "links"
RETURN p.title AS paper, p.venue AS venue, p.year AS year
```

## 4. Signs and built-in properties

Every relationship has `r.sign` (`1` or `-1`) and `r.id`. Every node has `n.title`, `n.path` and `n.stub`.

```graph-query
view: table

MATCH (a)-[r]->(b)
WHERE r.sign = -1
RETURN a.title AS source, type(r) AS type, b.title AS target, r.id AS id
```

Useful functions: `type(r)`, `labels(n)`, `id(x)`, `keys(x)`, `properties(x)`, `startNode(r)` and `endNode(r)`.

```graph-query
view: table

MATCH (:Company {title: "Acme"})-[r:funds]->(p)
RETURN p.title AS project, keys(r) AS keys, properties(r) AS props
```

## 5. Several patterns at once

Comma-separated patterns must all match. Reusing a variable joins them. Who works at the company that funds the project they contribute to?

```graph-query
MATCH (p:Person)-[c:contributes]->(proj:Project), (co:Company)-[f:funds]->(proj), (p)-[w:works_at]->(co)
RETURN p, c, proj, f, co, w
```

A longer chain written in one pattern: papers by people who work at Acme.

```graph-query
view: table

MATCH (:Company {title: "Acme"})<-[:works_at]-(p:Person)-[:authored]->(paper:Paper)
RETURN p.title AS author, paper.title AS paper, paper.year AS year
```

## 6. `OPTIONAL MATCH`

`MATCH` drops rows that do not fit. `OPTIONAL MATCH` keeps them and fills the missing parts with `null`, like a left join.

```graph-query
view: table

MATCH (p:Person)
OPTIONAL MATCH (p)-[:authored]->(paper:Paper)
RETURN p.title AS person, paper.title AS paper
ORDER BY person
```

## 7. Aggregation

`count`, `sum`, `avg`, `min`, `max` and `collect` combine rows. Every non-aggregated column becomes a grouping key, like `GROUP BY` in SQL.

```graph-query
view: table

MATCH (p:Person)-[c:contributes]->(proj:Project)
RETURN proj.title AS project, count(p) AS people, sum(c.hours) AS hours, collect(p.title) AS who
ORDER BY hours DESC
```

`count(*)` counts rows, and `DISTINCT` removes duplicates first:

```graph-query
view: table

MATCH (a)-[r]->(b)
RETURN type(r) AS type, count(*) AS edges, count(DISTINCT a) AS sources
ORDER BY edges DESC
```

Totals over the whole graph have no grouping key:

```graph-query
view: table

MATCH (:Company)-[f:funds]->(:Project)
RETURN sum(f.amount) AS total_funding, avg(f.amount) AS average, max(f.amount) AS largest
```

## 8. Chaining with `WITH`

`WITH` works like `RETURN` but passes its result on to the next part of the query. Use it to filter on an aggregate, which `WHERE` alone cannot do:

```graph-query
view: table

MATCH (p:Person)-[:contributes]->(proj:Project)
WITH p, count(proj) AS projects
WHERE projects > 1
RETURN p.title AS person, projects
```

After `WITH`, only the variables it lists stay in scope.

```graph-query
view: table

MATCH (c:Company)<-[:works_at]-(p:Person)
WITH c, count(p) AS staff
ORDER BY staff DESC
LIMIT 1
MATCH (c)-[f:funds]->(proj)
RETURN c.title AS biggest_employer, staff, collect(proj.title) AS funds
```

## 9. Variable-length paths

`*min..max` follows a relationship several times. Everything the Search project depends on, directly or not:

```graph-query
MATCH (s:Project {title: "Search"})-[:depends_on*1..3]->(dep)
RETURN DISTINCT dep.title AS dependency
```

Bind the whole path to a variable with `p = ...` to draw it or measure it. `nodes(p)` and `relationships(p)` return its parts as lists, and `[1]` picks the second element:

```graph-query
MATCH p = (:Paper {title: "Learning to Rank Notes"})-[:cites|about|broader*1..3]->(x)
RETURN p
```

```graph-query
view: table

MATCH p = (a:Person {title: "Alice"})-[*1..2]->(x:Topic)
RETURN x.title AS topic, length(p) AS hops, nodes(p)[1].title AS via
ORDER BY hops, topic
```

Other forms: `*` (any length, up to the configured depth limit, 10 by default), `*2` (exactly two), `*..3` (up to three) and `*2..` (two or more).

## 10. Sorting and paging

`ORDER BY` sorts (add `DESC` for descending), `SKIP` drops rows and `LIMIT` caps them:

```graph-query
view: table

MATCH (p:Person)-[c:contributes]->(proj)
RETURN p.title AS person, proj.title AS project, c.hours AS hours
ORDER BY hours DESC
SKIP 1
LIMIT 3
```

`RETURN DISTINCT` removes duplicate rows:

```graph-query
view: table

MATCH (:Person)-[:interested_in]->(t:Topic)
RETURN DISTINCT t.title AS topic
```

## 11. Stubs and schema checks

Stubs are nodes with `stub = true`. List the notes you still need to write:

```graph-query
view: table

MATCH (a)-[r]->(s)
WHERE s.stub = true
RETURN s.title AS missing_note, collect(a.title) AS linked_from
```

Find edges outside a type's schema, the same check *Show diagnostics* does:

```graph-query
view: table

MATCH (p:Person)-[r]->(x)
WHERE NOT type(r) IN ["knows", "mentors", "works_at", "leads", "contributes", "authored", "interested_in", "trusts", "distrusts", "reviews"]
RETURN p.title AS person, type(r) AS unexpected_edge, x.title AS target
```

## 12. Limits

The built-in engine is read-only. `CREATE`, `MERGE`, `SET`, `DELETE` and `REMOVE` are rejected with a clear error. It also does not support `UNWIND`, `UNION`, `CALL`, `CASE` or regular expressions (`=~`).

For those, run the sidecar and add `backend: ladybug` to the block header. The same query then runs on the LadybugDB mirror. See [[Sidecar and agents]]. This example is shown as plain text so it does not fail without a sidecar:

````markdown
```graph-query
backend: ladybug
view: table

MATCH (p:Person)
RETURN p.title AS name,
       CASE WHEN p.role IS NULL THEN "unknown" ELSE p.role END AS role
```
````

Errors point at a line and column. Try breaking this query (for example, delete `RETURN`) to see one:

```graph-query
view: table

MATCH (n:Topic)
RETURN n.title AS topic
```

## Cheat sheet

| Goal | Cypher |
|---|---|
| Nodes with a label | `MATCH (n:Person) RETURN n` |
| Edges of a type | `MATCH (a)-[r:knows]->(b) RETURN a, r, b` |
| Either direction | `MATCH (a)-[r:knows]-(b)` |
| Several types | `-[r:trusts\|distrusts]->` |
| Filter on a property | `WHERE n.year >= 2022` |
| Negative edges | `WHERE r.sign = -1` |
| Pinned or derived id | `RETURN r.id` |
| Missing property | `WHERE n.role IS NULL` |
| Stubs | `WHERE n.stub = true` |
| Count per group | `RETURN n.status, count(*)` |
| List per group | `RETURN c.title, collect(p.title)` |
| Filter on an aggregate | `WITH n, count(*) AS k WHERE k > 1` |
| Optional part | `OPTIONAL MATCH (n)-[:authored]->(p)` |
| 1 to 3 hops | `-[:depends_on*1..3]->` |
| Whole path | `MATCH p = (a)-[*1..2]->(b) RETURN p` |
| Top N | `ORDER BY x DESC LIMIT 5` |

Next: [[Query gallery]].
