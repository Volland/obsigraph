# One vocabulary for the whole team: using the code ontology

*How developers, architects, product people and coding agents share one small ontology that `tg init` installs, that lives in plain files, and that exports to any tool that reads SHACL.*

---

## The problem it solves

In [the first article](typed-graph-for-coders.md) the argument was that a codebase has two graphs: the structure graph your tools derive, and the intent graph only people can write. Typed links connect them.

That left a practical question: which types? If every team invents its own words, a developer writes `implements`, an architect writes `realizes`, an agent writes `relates_to`, and the graph stops answering questions because nobody asks for the same thing twice.

So the vocabulary now ships with the tool. Run:

```
tg init --write
```

and next to the agent instructions, hooks and skills you get two more files:

- `lat.md/code-ontology.md`, a short guide note: the types, the edges, the rules of use. It is an ordinary lat.md section, so `tg check` verifies its links, and people and agents find it with `tg search`.
- `ontology/code-types.md`, the same vocabulary as a schema in the open Typed Graph Schema (TGS) format. It is YAML frontmatter in a Markdown note.

Nothing here needs a server or a database. Both are files in git.

## What is in it

Six kinds of intent, written by people:

| Type | It records |
|---|---|
| `Decision` | a choice, its reason, the alternatives rejected |
| `Requirement` | something the system SHALL do |
| `Scenario` | a checkable example of a requirement |
| `Constraint` | a rule nobody here chose: a regulation, an SLA, a platform limit |
| `Concept` | a domain term with one exact meaning |
| `Change` | a unit of work that moves intent and code together |

Code is the other layer. `tg` derives `CodeFile` and `CodeSymbol` nodes from your source, so you never write them.

Eleven kinds of edge connect the two:

| Question | Edges |
|---|---|
| Is it built, and does it work? | `implements`, `verifies` |
| Does it agree? | `-contradicts`, `supersedes` |
| Why is it this way? | `motivated_by`, `constrains`, `refines` |
| What does it touch? | `depends_on`, `defines` |
| How did it change? | `introduced_by`, `changed_by` |

The minus sign is reserved for disagreement. Facts about the relationship go on the relationship: `since`, `until`, `ticket`, `confidence`.

## Writing it down

There are two things to do, and both are small.

**Give a file a type.** Put `type:` in the frontmatter of any file under `lat.md/`, and every section below its title gets that label:

```markdown
---
type: Requirement
---
# Requirements

Authentication requirements for the API.

## Token expiry

Access tokens SHALL expire after 15 minutes.
```

A file holds one kind of thing, or a list: `type: [Requirement, Scenario]`.

**Link code to intent** with a comment above the declaration it describes:

```ts
// @tg: implements:: [[requirements#Token expiry]] {since: "2.3"}
export function verifyToken() {}

// @tg: -contradicts:: [[decisions#Stateless sessions]] {until: "2026-Q4"}
export function session() {}
```

Then ask the graph. I ran these in a scratch project with exactly the files above plus a second requirement, `Refresh`, that nothing implements. The output is real:

```
tg cypher --code annotated "
  MATCH (s:Requirement)
  OPTIONAL MATCH (c)-[r:implements]->(s)
  WITH s, count(r) AS n WHERE n = 0
  RETURN s.section"

s.section
--------------------------------------------
lat.md/requirements#Requirements#Refresh
```

```
tg cypher --code annotated "MATCH (c)-[r:contradicts]->(d) RETURN c.symbol, d.section, r.until, r.ticket"

c.symbol | d.section                                     | r.until | r.ticket
session  | lat.md/decisions#Decisions#Stateless sessions | 2026-Q4 | null
```

One requirement nothing implements, and one place where the code knowingly goes against a decision, with an expiry date. Neither answer needed a meeting.

## Who does what

The same graph serves four kinds of reader. What differs is which part each one owns.

### Developers

You own the `@tg:` comments. The habit is the same as a test: when you write a function that realizes a requirement, you say so in one line above it. When you work against a decision and cannot fix it today, you write `-contradicts` with an `until` and a ticket, so the debt names what it is against.

Before you finish, `tg check` tells you if a link points at something that no longer exists. In review, a missing or wrong edge shows up in the diff like any other line.

### Architects

You own Decisions, Constraints and Concepts. A decision is a section: what was decided, why, and what was rejected. A constraint names its `source`, because a constraint nobody can trace is a rumor.

The edges you read are `contradicts` and `supersedes`. The first query is "every knowing contradiction, soonest expiry first". The second is "decisions with nothing superseding them", which is your list of what is still live.

### Product

You own Requirements and Scenarios. Tag them with a `status` (draft, stable, deprecated), a `risk` (low, medium, high) and an `owner`. Those three cover most of what gets asked.

Your questions are coverage questions. What did we promise that nothing implements? What is implemented but has no test that proves it? The second is one query:

```
tg cypher --code annotated "
  MATCH (s:Requirement)<-[:implements]-(c)
  OPTIONAL MATCH (t)-[v:verifies]->(s)
  WITH s, count(v) AS n WHERE n = 0
  RETURN DISTINCT s.section"
```

In the scratch project it returned `Token expiry`: built, never verified.

You do not need to read code. You need the section names, and the graph tells you which are healthy.

### Agents

An agent reads the project cold. The ontology gives it two things the files alone cannot.

First, a vocabulary. `tg init` adds a line to the managed block in `CLAUDE.md` or `AGENTS.md` telling the agent to use the edge names in `lat.md/code-ontology.md` and not to invent synonyms. A model that writes `@tg: realizes::` is guessing. One that reads the guide writes `implements`.

Second, a way to ask. Over MCP the agent calls `tg_cypher` with the queries above, so "what is the rule here and what is a workaround?" becomes a lookup. The `tg-graph` skill that `tg init` installs includes the ontology queries as examples.

An agent should write edges, and a person reads them before they land. An edge is a claim, and a claim nobody has read is the same as no claim.

## Taking it somewhere else

The schema is the portable part. TGS is an open format with a JSON Schema, and it maps to the W3C SHACL standard:

```
tg schema export shapes.ttl --schema-folder ontology
```

That writes the six types and eleven edge types as SHACL shapes in Turtle; the test suite checks that the export reports exactly those counts and no diagnostics. Hand the file to any RDF tool, load it into a triple store, or keep it as the contract between teams. `tg schema import` goes the other way, so an existing SHACL model can become a schema note you edit by hand.

In Obsidian, open the project folder as a vault and set the schema folder to `ontology`. The plugin validates notes against the types and colors the graph by type, and the schema styles `contradicts` as a red dashed line. The same approach works for a research vault, a company wiki or a product spec folder: only what the node types mean changes.

Because the vocabulary is data, a team that disagrees with a name changes one file. Rename `Decision` to `ADR`, drop `Concept`, add `Risk`, and the exported shapes follow.

## What it does not do

The limits decide whether this fits you.

- **Names are a convention, not a lock.** `tg check` validates that links resolve and that test specs are covered. It does not reject an edge name that is missing from the schema. The schema is enforced in an Obsidian vault, exported to other tools, and read by agents.
- **Typed edges start in code.** `@tg:` types the edge from a declaration to a section. A link between two sections in `lat.md/` is a plain `references` edge in `tg cypher`, so write the relation in the sentence ("This replaces ...") and keep the typed edge for code or an Obsidian vault.
- **`type:` labels a whole file.** Every section below the title gets it, so keep one kind of thing per file.
- **It costs writing.** A generator would write less, and the previous article explains why a generated intent graph cannot check the code. If you only need checked links, plain `@lat:` comments are cheaper.

## Start in ten minutes

```
npm install -g @typedgraph/cli
cd your-project
tg init            # dry run: shows every file it would write
tg init --write
```

Then:

1. Create `lat.md/requirements.md` with `type: Requirement` and three requirements you actually argue about.
2. Add one `@tg: implements::` above the function that does each, and one `verifies::` above a test.
3. Run `tg check`, then the "requirements nothing implements" query.
4. If the answer surprised you, write the decisions next. If it didn't, stop and use plain links.

`tg init` does not overwrite the two ontology files on later runs, so edit them to fit your team. Pass `--no-ontology` for the agent setup without them. These features are in the next release; until then, build `tg` from this repository.

---

Want ontologies for other domains, such as books, notes or agents? See the [ontology gallery](ontologies.html) and [how they combine](composable-ontologies.md).

*Typed Graph and the `tg` CLI are open source (MIT). Docs and the other articles are at [volland.github.io/obsigraph](https://volland.github.io/obsigraph/). TGS is an open specification and SHACL is a W3C standard. lat.md is a separate project by Yury Selivanov, and Typed Graph is not affiliated with it.*
