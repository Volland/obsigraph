# Ontologies you can download, and combine

*A gallery of four ready-made ontologies as plain Markdown, how to use each, and the rules that let you put several into one graph without them stepping on each other.*

---

## Start from someone else's types

The hardest part of a typed graph is not the syntax. It is deciding what the types are. The [code ontology](code-ontology-in-practice.md) answered that for one domain. This gallery does it for four, and each is a folder you can download and open:

| Ontology | Types | For |
|---|---|---|
| **Zettelkasten** | Zettel, Source, Topic | atomic notes that cite sources and live under topics |
| **Book management** | Book, Author, Series, Genre, Quote | what you own, are reading, and want to read |
| **Coding and requirements** | Requirement, Scenario, Decision, Constraint, Concept, Change, Stakeholder, Release, Risk | what the product SHALL do, why, for whom, and what could go wrong |
| **Prompts and agents** | Prompt, Agent, Tool, Skill, Knowledge, Eval | a catalogue of prompts, agents and what they call and read |

The [gallery page](ontologies.html) has the downloads. There is also a fifth folder, `core`, which we will come back to, because it is the reason the other four can be combined.

## What you are downloading

An ontology here is not a file format of its own. It is a folder:

```
library/
  Types/
    Library.md        the schema: types, edge types, properties
  Examples/
    Dune.md           a few notes so the graph is not empty
    Frank Herbert.md
  README.md
```

`Library.md` is an ordinary Markdown note whose frontmatter is the schema, written in the open Typed Graph Schema (TGS) format:

```yaml
---
tgs: "0.1"
schemas:
  Book:
    properties:
      status: {values: [wishlist, to-read, reading, finished, abandoned], default: to-read}
      rating: number
      started: date
    edges:
      written_by: {target: Author, required: true}
      in_series: Series
edgeTypes:
  in_series: {from: Book, to: Series, properties: {volume: number}}
---
```

A data note says what it is with `type:` and links with typed edges:

```markdown
---
type: Book
status: reading
started: 2026-03-02
---
## Links

written_by:: [[Frank Herbert]] {role: "author"}
in_series:: [[Dune Chronicles]] {volume: 2}
```

Because the schema is data, the plugin can validate the note, color the graph by type, and offer the types when you create a note. A missing `written_by` is a warning on the note. Nothing is ever removed from the graph.

## Using one

1. Download the `.zip` and unzip it.
2. In Obsidian, open the folder as a vault and turn on the Typed Graph plugin. The schema folder is `Types/`, the plugin's default.
3. Open an example note, then ask the graph something. In the book vault, what am I reading?

```cypher
MATCH (b:Book {status: "reading"}) RETURN b.title, b.started ORDER BY b.started
```

4. Delete `Examples/` and write your own notes.

To add an ontology to a vault you already have, copy its schema notes into your schema folder. Notes without a matching `type:` are untouched.

Outside Obsidian, the same files work from the command line, and `tg schema export shapes.ttl --vault <folder>` writes any of them as W3C SHACL for RDF tools.

## Why composition needs rules

A single ontology is easy. The interesting case is a person who keeps a Zettelkasten, a reading list and a product backlog in one vault, or a team whose prompts and agents must point at the requirements they implement. They want the types of several ontologies at once.

TGS lets you do that by putting several schema notes in the schema folder. Each note declares its own types and edge types, and the reader merges them. The rules are short, and they are written in the specification.

- **A type or edge type is declared once.** If two notes declare the same name, the reader uses the one whose path sorts first and reports a duplicate naming both notes.
- **A note can have several labels.** `type: [Book, Source]` gives the note the properties and edges of both. For properties the first declaration wins. For edges the allowed lists are combined.
- **Edge rules live in two places.** A type says which edges it may have, an edge type says which types its ends may be, and when both name targets the type's entry wins for sources of that type.

## What went wrong the first time

I put all four ontologies in one folder and ran the validator. Two diagnostics:

```
Types/Zettelkasten.md  Edge type 'contradicts' is declared in both Types/Requirements.md and Types/Zettelkasten.md; using Types/Requirements.md
zettelkasten/Examples/Folders are enough.md  Edge 'contradicts' expects source type Requirement or Decision, found Zettel
```

Both ontologies used the word `contradicts`, and both declared it. The Zettelkasten wanted it between zettels. The requirements ontology wanted it between requirements and decisions. Whichever note sorted first won, and the other's edges became errors.

Nothing was wrong with either ontology on its own. The clash only exists when they meet, which is exactly when you cannot see it from inside either one.

## The shared core

The fix is a pattern, not a patch. An edge type that more than one ontology uses is declared once, in a small base note that every ontology builds on:

```yaml
---
tgs: "0.1"
edgeTypes:
  contradicts:
    properties: {why: text, until: text, ticket: text}
    visualization: {color: "#e5484d", line: dashed}
---
```

This is `core/Types/Core.md`. It says what the edge is, with no restriction on its ends. Each ontology then says which of its own types may use it, in the type's `edges` list, and how to draw it. Zettelkasten allows `contradicts` between zettels. Requirements allow it from a requirement or decision to a decision, requirement or constraint.

Every download already contains `Core.md`, and `all.zip` is the four ontologies and the core composed in one vault. With the core in place, the same combined vault validates with no diagnostics.

The rule of thumb: **the first time a second ontology needs a word the first already declared, move the declaration to the core.** Names that only one ontology uses stay in that ontology.

## Bridging with a mixin

Sharing an edge name is the easy case. The harder one is a link that belongs to neither ontology: a prompt that implements a requirement. `Prompt` knows nothing about `Requirement`, and `Requirement` knows nothing about `Prompt`. You cannot add the edge to `Prompt` without editing the agents ontology, and editing a downloaded ontology is how you lose the ability to update it.

The way out is a **mixin**: a small type, in your own bridge note, that exists only to grant an edge.

```yaml
---
schemas:
  Traceable:
    edges:
      implements: Requirement
edgeTypes:
  implements: {to: Requirement}
---
```

A note that needs the link takes both labels:

```markdown
---
type: [Prompt, Traceable]
purpose: Explain token expiry
---
## Links

implements:: [[Tokens expire after 15 minutes]]
```

Because allowed edges from several labels are combined, the note may have everything a `Prompt` may have and also `implements`. A prompt without the `Traceable` label that tries the same edge gets a warning that `implements` is not allowed. I ran both cases against the real validator, and they behave that way.

This keeps each ontology intact. The agents ontology stays a download you can update. Your bridge note is yours, and it is a few lines.

## The same trick for shared notes

Mixins also solve the case where one real thing belongs in two ontologies. A book you read is a `Book` in the library and a `Source` in your Zettelkasten. Do not make two notes. Label one:

```markdown
---
type: [Book, Source]
author: Donella Meadows
status: finished
---
## Links

written_by:: [[Donella Meadows]]
```

Your zettel `cites::` it, and your reading log `written_by::` it. Both ontologies see the same node, with properties from each and no duplication. The test suite does exactly this and expects no diagnostics.

## Design advice for your own ontologies

If you build one for the gallery or for your team, these are the habits that kept the four above composable.

- **Prefix a name only when you have to.** Plain names such as `Book` and `cites` read well, but they are the ones that clash. Keep the generic words for the core and make anything specific to your domain unlikely to collide, such as `written_by` over `by`.
- **Do not restrict the ends of an edge type you expect others to reuse.** Put the restriction on the type's own `edges` list, where it belongs to your ontology, and leave the edge type open.
- **Give every type and edge type a `uri` when you plan to exchange it.** A type can say it is `schema:Book`, so a tool that knows schema.org understands it, and two ontologies that map to the same identifier can be matched even when their local names differ.
- **Keep one concern per ontology.** A reading list and a Zettelkasten are separate until a note belongs to both, and then a label bridges them.
- **Test the composition, not only the parts.** Each ontology here validates alone, and one test puts them all in a folder together. The clash above was found by that test, not by reading.

## What it does not do

- **There is no import statement.** Composition is "put the notes in the same folder". That is simple and it makes clashes yours to resolve.
- **Validation is advisory.** A disallowed edge is a diagnostic on the note. It never blocks you and never deletes anything.
- **The `tg` command line does not validate against these schemas.** In a code repository `tg check` verifies links and test coverage. The schemas are enforced by the Obsidian plugin and exported to other tools, and agents can read them.
- **They are starting points.** Expect to rename half of every ontology. The point of making them plain notes is that renaming is an edit.

## Try it

Download [all.zip](ontologies/all.zip), open it as a vault and look at the graph: a book, a zettel that cites it, a requirement and a prompt in one view, colored by type. Then remove the three ontologies you do not need.

If you make one you would like to share, send a pull request to the `ontologies/` folder. It needs to read without diagnostics, and the tests check that for every ontology and for their composition.

---

*Typed Graph and the `tg` CLI are open source (MIT). Docs and the other articles are at [volland.github.io/obsigraph](https://volland.github.io/obsigraph/). TGS is an open specification and SHACL is a W3C standard.*
