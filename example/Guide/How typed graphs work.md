# How typed graphs work

Obsidian already has a graph: notes are dots and links are lines. That graph cannot say *how* two notes are related. Typed Graph turns the vault into a **property graph**, the model used by graph databases such as Neo4j and LadybugDB:

- **Nodes** have **labels** (what kind of thing they are) and **properties** (facts about them).
- **Edges** (relationships) have a **type** (what the link means), a **direction**, a **sign** and their own **properties**.

Everything is stored in plain Markdown. The plugin only reads your notes and never changes them.

## Nodes

Every note is a node. Its id is its path, for example `People/Alice.md`.

Labels come from the `type` field in frontmatter. A list gives several labels:

```markdown
---
type: [Person, Engineer]
role: engineer
language: Rust
---
```

All frontmatter fields become node properties, plus three built-ins: `title` (the file name), `path` and `stub`.

```graph-query
view: table

MATCH (n)
WHERE n.path STARTS WITH "People/"
RETURN n.title AS note, labels(n) AS labels, n.role AS role, n.path AS path
ORDER BY note
```

## Edges

An edge is one line in a note. The note containing the line is the **source**:

```markdown
knows:: [[Bob]]
knows:: [[Carol]] {since: 2018, label: "met at conf"}
- works_at:: [[Acme]], [[Initech]] {role: engineer}
```

- `knows::` is the edge **type**. This is the same syntax as the Graph Link Types plugin, so existing lines keep working.
- `[[Bob]]` is the **target**. Several comma-separated targets make several edges with the same properties.
- `{...}` holds **edge properties**: numbers, booleans, quoted or bare strings and lists.
- A leading `- ` (list item) is allowed.
- The nearest heading above the line is recorded on the edge.
- Lines inside code blocks (like the ones on this page) and in frontmatter are ignored.

A plain `[[link]]` in prose is **not** a typed edge. Only `type::` lines are.

```graph-query
view: table

MATCH (a)-[r]->(b)
WHERE a.title = "Alice"
RETURN type(r) AS type, b.title AS target, r.since AS since, r.sign AS sign
ORDER BY type
```

## Signs

A `+` or `-` before the type sets the edge's **sign**. The default is `+1`:

```markdown
+trusts:: [[Bob]] {weight: 0.9}
-distrusts:: [[Mallory]]
```

Signs model trust, agreement, support versus opposition, and similar relations. Negative edges are drawn dashed red with a flat (tee) arrow head. In queries the sign is `r.sign`. `weight` is an ordinary property.

```graph-query
MATCH (a)-[r]->(b)
WHERE r.sign = -1
RETURN a, r, b
```

## Edge ids

Every edge gets an id `source#type#target#n`, where `n` counts duplicates. To reference an edge permanently, **pin** an id:

```markdown
knows:: [[Bob]] {since: 2020, id: "alice-knows-bob"}
```

Pinned ids survive reordering and editing of other lines. Embeds should use them.

## Stubs

A link to a note that does not exist creates a **stub** node, drawn faded. Here [[Mallory]] knows Eve, Initech competes with Globex, and a paper cites "Property Graphs 101"; none of those notes exist yet. Create one of them and its stub turns into a real node.

```graph-query
MATCH (a)-[r]->(s)
WHERE s.stub = true
RETURN a, r, s
```

## Schema notes

A note directly inside `Types/` describes the type named by its file name. [[Person]] looks like this:

```yaml
schema:
  properties:
    role: {kind: text, required: true}
    joined: date
  edges: [knows, mentors, works_at, ...]
  visualization:
    color: "#7c5cff"
    shape: ellipse
    icon: user
    edges:
      knows: {color: "#f5a524", line: dotted}
```

- **properties**: kinds are `text`, `number`, `boolean`, `date`, `datetime`, `link` and `list`, with optional `default`, `required`, `many` (a list value) and `values` (allowed values).
- **edges**: the outgoing edge types allowed, as a list or as a map to target types (`works_at: Company`). Leave it out to allow any.
- **visualization**: node `color`, `shape`, `icon` and `label` (a property shown instead of the title), plus per-edge-type `color` and `line`.
- **The body is a template.** *Create note from type* fills in the frontmatter with defaults and copies the body. A type can point to a separate template note with `template: "[[...]]"`, and a type with no template gets one generated from its schema.

One schema note can also describe several types under `schemas:` and edge types under `edgeTypes:`. [[Relations]] declares no type of its own. It says that `works_at` runs from a Person to a Company and needs a `role`, and that `mentors` connects two people:

```yaml
edgeTypes:
  works_at:
    uri: schema:worksFor
    from: Person
    to: Company
    properties:
      role: {kind: text, required: true}
      since: number
```

An edge pointing at the wrong type of note, or missing a required edge property, is reported like any other schema issue. *Export schemas as SHACL* turns all of this into W3C SHACL shapes for RDF tools, and *Import SHACL shapes* reads shapes back into schema notes. The format is the open [Typed Graph Schema](https://volland.github.io/obsigraph/spec/tgs/v0.1/) specification.

Schemas are optional and **advisory**. A missing required property ([[Dave]]) or an edge type the schema does not list ([[Mallory]]'s `sells_to`) appears in the status bar and in *Show diagnostics*, but the note and edge still work.

A note with several labels merges their schemas in label order. The first declaration of a property wins and allowed edges are combined. That is why [[Bob]] (`[Person, Engineer]`) is drawn as a purple ellipse while [[Carol]] (`[Engineer, Person]`) is a red hexagon.

## Styling

Each style attribute is resolved separately, and the most specific source wins:

1. The query block header, for example `node.Person: color=red`
2. The schema note's `visualization`
3. *Settings → Type styles / Edge styles*
4. Built-in defaults: a stable color per type; negative edges dashed red

Select a node in the Graph view to see which source each attribute came from.

## Edge embeds

You can show an edge's properties inside prose:

| You write | You see |
|---|---|
| `{{edge: alice-knows-bob . since}}` | {{edge: alice-knows-bob . since}} |
| `{{edge: Alice -knows-> Bob . label}}` | {{edge: Alice -knows-> Bob . label}} |
| `{{edge: alice-mallory . why}}` | {{edge: alice-mallory . why}} |
| `{{edge: Bob -contributes-> Search . hours}}` | {{edge: Bob -contributes-> Search . hours}} |

Leave out `. property` to get the whole property table:

{{edge: Acme -funds-> Search}}

Put a sign inside the arrow to require it: `--distrusts->` matches only negative edges, `-+trusts->` only positive ones:

- Alice's negative edge to Mallory, reason: {{edge: Alice --distrusts-> Mallory . why}}

Embeds update live and show a marker, never an error, when nothing matches. Embeds that find an edge by its endpoints instead of a pinned id get a hint in *Show diagnostics* suggesting an id.

## What the core Graph view shows

Obsidian's built-in Graph view is not modified. It still draws plain links. To color types there, open its *Groups* section and add one group per type with a search such as `[type:Person]`. For edge types, signs and properties, use **Typed Graph: Open graph view**.

Next: [[Cypher manual]].
