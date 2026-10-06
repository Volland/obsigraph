# Graph Model

The in-memory property graph built from the vault: notes become labeled nodes, parsed lines become typed edges with properties.

## Nodes

One note is one node; headings and blocks are not nodes in v1.

Links to notes that do not exist become stub nodes, keyed by link text, so the graph has no dangling edges. Stubs are reference-counted and vanish with their last edge. Implemented by [[packages/core/src/graph/graph.ts#Graph]], which stores parsed edges per file so re-resolution after add, delete or rename needs no re-parse.

## Node types

A node's labels come from frontmatter `type: Person` or `type: [Person, Employee]`, which maps to multiple openCypher labels.

Configurable fallbacks map folder or tag to type when frontmatter is absent.

A non-empty frontmatter `title` becomes the node's `title` property; otherwise it is the file name.

A `types` list adds labels after those from `type`, deduplicated; the [[okf]] export writes it because OKF's `type` is a single string.

## Schema notes

A schema note such as `Types/Person.md` declares a type's properties, defaults, allowed edge types and visualization, in the spirit of typed templates.

Schema notes are optional; the graph works without them. Creating a note from a type applies its template.

A note directly in the schema folder (setting, default `Types/`) declares the type named by its title in frontmatter under `schema:` — `properties` (map, kind shorthand or list; kinds text, number, boolean, date, link; `default`, `required`), `edges` (allowed outgoing types, absent means unrestricted) and `style` (consumed by visualization config). The body is the template. Read by [[packages/core/src/schema/schema.ts#readSchema]], validated by [[packages/core/src/schema/schema.ts#validateSchemas]] (advisory diagnostics only) and rendered into new notes by [[packages/core/src/schema/schema.ts#renderNoteFromType]]. Multi-label notes merge schemas in label order: first property declaration wins, allowed edge lists are unioned.

## Edges

Edges carry a type, optional label, sign, properties, a derived or pinned ID and the heading they were written under.

Syntax is defined in [[edge-syntax]].

## Plain link edges

With the `linkEdges` graph option, every plain wikilink or markdown link to a note in prose becomes an untyped `links_to` edge (sign +1), as OKF consumers read links.

The option is off by default so existing vaults keep their graphs and queries; it is the third argument of [[packages/core/src/graph/graph.ts#Graph]] and is passed to the parser. Lines that already produce typed edges, fenced and inline code, frontmatter and image embeds (`![..](..)`, `![[..]]`) never yield link edges; missing targets become stubs as usual. The sidecar turns it on with `OBSIGRAPH_LINK_EDGES=1`.
