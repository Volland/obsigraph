# Zettelkasten ontology

The note types of the Zettelkasten method, the sources they come from (books, articles and papers), the highlights you take from them and the topics that index it all. Open this folder as an Obsidian vault with the Typed Graph plugin, or copy `Types/` into your own vault.

## The method, as types

| Type | What it is | Method name |
|---|---|---|
| `FleetingNote` | A quick capture, processed within a day or two. `status`: inbox, processed, discarded. | fleeting note |
| `LiteratureNote` | A source rewritten in your own words. Must `cites` a source. | literature note |
| `PermanentNote` | One idea that stands alone and links to other permanent notes. `confidence`, `luhmann` id. | permanent note |
| `StructureNote` | A hub that `indexes` permanent notes in reading order. | structure / hub note |
| `ProjectNote` | A working note for a writing project; it `draws_on` the notes it uses. | project note |

Sources and what comes from them:

| Type | What it is |
|---|---|
| `BookSource`, `ArticleSource` | A book or an article, with `year`, reading `status` and (for articles) `publication` and `url`. Each needs `authored_by` a writer and can be `about` topics. |
| `PaperSource` | A research paper, with `year`, `kind` (journal, conference, preprint, thesis, report), `venue`, `doi`, `url` and reading `status`. Needs `authored_by` a writer, and `cites` the books, articles and papers in its bibliography. |
| `Writer` | The author of a source. |
| `Highlight` | Raw text you marked in a book, article or paper, with `page` and `color`. Must be `highlighted_in` a source. |
| `Topic` | A subject (`seed`, `growing`, `mature`) that notes, sources and highlights are `about`. |

## Following a note from capture to idea

A note moves forward by writing a new one and linking back, so the trail stays in the graph:

`Highlight` ← `based_on` ← `LiteratureNote` ← `derived_from` ← `PermanentNote`, and `FleetingNote` `processed_into` a literature or permanent note.

Other edges: `extends`, `supports`, `example_of`, `follows` (with a `luhmann` id) and `contradicts` (shown dashed red) between permanent notes, `cites` from literature and permanent notes to sources and from a paper to the sources it cites, and `related_to` between topics.

## Ids and templates

Every type gets a time-ordered `uid` (UUID version 7, which sorts as a string) when you create a note from it, so notes keep a stable id even when you rename them. Permanent notes can also carry a Luhmann id (`1`, `1a`, `1a1`, `2`): in Obsidian use *New child note*, *New sibling note* or *New top-level note*, in VS Code *TypeGraph: New Child Note*. The new note gets the next free id and a `follows` edge back to its parent, with the id on the edge. This needs TGS 0.2, so the schema note declares `tgs: "0.2"`.

`Templates/` has one template per note type, with `{{title}}`, `{{date}}`, `{{parent-link}}` and `{{luhmann}}` filled in when the note is made. Edit them freely; a type's `template:` link points at its template.

## Questions it answers

```cypher
MATCH (p:PermanentNote) OPTIONAL MATCH (p)-[r:cites]->(s) WITH p, count(r) AS n WHERE n = 0 RETURN p.title
```

- Which fleeting notes are still in the inbox?
- Which highlights have no literature note yet?
- Which permanent notes come from which book or paper, and which writers feed a topic?
- Which papers I have notes on cite each other?
- Which permanent notes contradict another note?

## Mixing with the library ontology

Writers are `Writer` and books are `BookSource` so this ontology does not clash with the library's `Author` and `Book`. Label one note with both, for example `type: [Book, BookSource]` or `type: [Author, Writer]`, and it carries the properties and edges of each.

`Examples/` holds a small linked Zettelkasten about note-taking so the graph is not empty on first open; delete it when you start. The page numbers and dates in it are illustrative.
