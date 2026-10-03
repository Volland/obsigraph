# Graph Model

The in-memory property graph built from the vault: notes become labeled nodes, parsed lines become typed edges with properties.

## Nodes

One note is one node; headings and blocks are not nodes in v1.

Links to notes that do not exist become stub nodes so the graph has no dangling edges.

## Node types

A node's labels come from frontmatter `type: Person` or `type: [Person, Employee]`, which maps to multiple openCypher labels.

Configurable fallbacks map folder or tag to type when frontmatter is absent.

## Schema notes

A schema note such as `Types/Person.md` declares a type's properties, defaults, allowed edge types and visualization, in the spirit of typed templates.

Schema notes are optional; the graph works without them. Creating a note from a type applies its template.

## Edges

Edges carry a type, optional label, sign, properties, a derived or pinned ID and the heading they were written under.

Syntax is defined in [[edge-syntax]].
