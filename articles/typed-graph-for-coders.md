# Your codebase has two graphs. You only maintain one.

*A deep dive into typed graphs as a working tool for developers: what to model, what to leave to the machine, and where specs belong now that they live in the repo.*

---

## The graph you already have

Every codebase already is a graph. Files import files. Functions call functions. Classes extend classes. Your language server, your IDE and your coding agent all walk this graph all day, and they are good at it. If you ask "what calls `verifyToken`?" you get an answer in milliseconds, and nobody needs to write anything down for that to work.

This is the *structure graph*. It is derived from the source. It is always up to date, because it is the source. And there is a whole category of tools that turn it into a pretty picture and call it a knowledge graph.

It answers one family of questions very well: **what**. What depends on this? What breaks if I change it? Where is this symbol used?

But watch what happens when you try to use it to answer the questions that actually slow a team down:

- Why do we validate tokens in the service and not at the gateway?
- Is the three-attempt retry loop a requirement, or did someone pick a number?
- Which function is supposed to enforce the expiry rule?
- We agreed sessions are stateless. What in the code still disagrees?
- Which parts of the payment flow have no test that proves they work?

None of these can be answered from the structure graph, and not because the tool is weak. The information is not in the source. The source says what the program does. It does not say what the program is *meant* to do, why it was built this way, or what was rejected on the way.

That information lives somewhere else. It lives in design docs, in decision records, in tickets, in a Slack thread from March, and mostly in the heads of the people who were in the room. Call this the *intent graph*. It is the second graph in your codebase, and for most teams it is barely a graph at all: a pile of prose with no reliable connection to the code it describes.

This article is about connecting the two, and about why the connection needs **types**.

---

## Why "linked" is not enough

The first step most teams take is to add links. A design doc mentions a function. A comment in the code points back at a doc section. This is a real improvement, and tools built around it, such as [lat.md](https://www.npmjs.com/package/lat.md), do it well. A `lat.md/` folder is a set of cross-linked Markdown files that describe what a project does and why, and a `check` command fails when a link points at something that no longer exists. That alone turns "the docs are stale" from a feeling into a build failure.

But a plain link has a limit. It says two things are related. It does not say how. Consider three comments, all of which link a function to the same section of a design doc:

- This function *implements* the rule.
- This function *violates* the rule, and is a leftover we haven't deleted.
- This function is a *test* that proves the rule holds.

To a plain link they are identical. A reader, human or agent, has to open each one and read the code to find out which it is. The information that matters, the *relationship*, is exactly the part the link throws away.

A **typed graph** keeps it. Each link has a type, a direction and, optionally, a sign and properties:

```
// @tg: implements:: [[auth#Token expiry]] {since: 2}
// @tg: -contradicts:: [[design#Stateless sessions]]
// @tg: verifies:: [[auth#Token expiry]]
```

The word before `::` is the edge type. A `-` in front makes the edge negative, so conflict is a first-class fact rather than a remark in a comment. The braces hold properties of the relationship itself. The edge starts at the declaration that follows the comment, so it names the function, not the whole file.

This is the same property-graph model that graph databases have used for years: nodes with labels and properties, relationships with a type, a direction and their own properties. The difference is where it lives. There is no database. The graph is rebuilt from plain Markdown and source comments, in memory, every time you ask.

Once links have types, you can *ask* the graph things:

```
tg cypher --code annotated "
  MATCH (s:Section)
  OPTIONAL MATCH (c:CodeSymbol)-[r:implements]->(s)
  WITH s, count(r) AS n WHERE n = 0
  RETURN s.section"
```

That lists every design section that nothing implements. Replace `implements` with `contradicts` and you get the places where the code works against a decision. Questions that used to cost an afternoon of grep and a meeting become one query. I ran both of these against the CLI while writing this.

---

## What a typed graph is for

Before going further, it is worth being precise about the job. A typed graph for a codebase is not documentation in a fancy format, and it is not a dashboard. It does three things.

**It makes drift detectable.** Documentation rots because nothing connects it to the code. When a link has a target that must exist and a coverage rule that must hold, drift becomes an error you see in CI instead of a surprise you meet in production.

**It makes intent queryable.** "Which requirements have no test?", "which decisions has nothing superseded?", "what is the blast radius of changing this rule?" are graph questions. They are not search questions and they are not grep questions, because they depend on the *kind* of relationship between things.

**It gives agents the missing half of the picture.** A coding agent can read your files, but it reads them cold. It does not know which function is the rule and which is a workaround. If the graph tells it that this function implements a constraint and that one is flagged as contradicting a decision, it stops guessing at intent and starts reading it. That is also the cheapest context you can give a model: a handful of typed edges, not the whole file tree.

---

## Why you cannot generate the intent graph

At this point the obvious objection arrives. *We already parse the code. Let a model read it, summarize every module into a doc, infer the edges, and regenerate the whole thing on every commit. No writing, no drift.*

It is a good idea for the structure graph, and a typed-graph tool should do exactly that: the code nodes in `tg` are derived in memory from your source and never written to disk. But for the intent graph it fails, for four reasons.

### 1. Generated docs cannot check the code

The value of a consistency check is that two *independent* things have to agree: what someone wrote down, and what the code does. If you generate the doc from the code, they agree by construction. Drift is no longer detectable, because there is nothing left for the code to drift *from*.

Worse, a bug becomes the specification. A generated doc that says "tokens are accepted for up to 90 days" is a faithful description of a mistake, and it will pass every check you run on it.

### 2. Intent is not in the artifact

A model reading the source can see a retry loop with three attempts. It cannot know that three is the number your payment provider's SLA allows, that it used to be five until an outage, or that nobody should raise it again. It will produce a *plausible* reason, and plausible reasons are the dangerous kind: they read as fact and they are invented.

Reasons, constraints and rejected alternatives exist only in the decision. Writing them down is the act of recording them. They cannot be recovered afterwards from the result.

### 3. The graph worth having is small

A graph inferred from code has an edge for every call. It is as large as the code, nobody reads it, and an agent pulls it into its context window as noise.

The graph you write by hand has a node per decision and an edge per claim someone chose to make. It is small on purpose, hundreds of sections for a serious project rather than hundreds of thousands of edges. That curation *is* the information. A long list of things you could say about the code is not the same as the ten things that must stay true.

### 4. Writing is where the design gets checked

Writing "this function implements the expiry rule" forces you to find the rule, and to notice that there are two functions, or none. Deriving the edge automatically skips that moment, and that moment is half the value. lat.md's leading-paragraph rule is the same idea in miniature: if a section can't be summarized in one sentence, it isn't clear yet.

So the division of labor is this:

> **Derive what the code can tell you. Write what only people know. Let a machine check that the two agree.**

Agents can and should help with the writing. An agent that has just changed a function is well placed to draft the doc update, and a stop hook can refuse to let it finish if it changed a lot of code and touched nothing in the docs. But a person reads the sentence before it lands, because the sentence is a claim, and a claim nobody has read is the same as no claim.

---

## Specs are code now

Something changed in the last couple of years that matters for all of this, and it is easy to miss because it happened in tooling rather than in theory.

For a long time, a specification was a separate thing. It lived in a wiki, a Confluence space, a Google Doc or a PDF. It was written *about* the software by someone who was, in a sense, outside it. It had its own lifecycle, its own owners, its own review process and, inevitably, its own drift.

Spec-driven workflows reverse this. Take [OpenSpec](https://github.com/Fission-AI/OpenSpec), the one this repository uses. A project has an `openspec/` folder, checked into git next to the source:

```
openspec/
  specs/
    tg-check/
      spec.md          # the current truth for one capability
    code-layer/
      spec.md
  changes/
    add-tg-annotations/
      proposal.md      # why
      design.md        # how
      tasks.md         # the work
      specs/           # the delta this change makes to the specs
  changes/archive/     # finished changes, dated
```

Each spec is written as requirements with scenarios, in a deliberately mechanical register:

```
### Requirement: Check
The system SHALL report every broken wiki link ... and SHALL exit 1 when any exist.

#### Scenario: Uncovered test spec
- **WHEN** a file with `require-code-mention: true` has a leaf section no code comment references
- **THEN** `tg check` reports that section and exits 1
```

Look at what this is. It is versioned in git. It changes in the same pull request as the code. A reviewer sees the spec diff and the code diff side by side. A change is a proposal, a design and a task list, and when it lands it is *archived* with a date, in the repository, forever. An agent implementing the work reads these files as its instructions.

That is not documentation about the software. That is **part of the software**. The spec is a source artifact with the same status as a module, a migration or a config file: it is reviewed, versioned, diffed, built from and, if you use it right, tested against.

This is the shift worth stating plainly, because it changes what a graph of a codebase should contain. If specs are code, then **a graph of the codebase that leaves them out is missing a layer of the codebase**. Requirements and scenarios should be nodes. A change should be a node with a lifecycle. The relationship between a requirement and the function that implements it, or the test that proves it, should be an edge, and a typed one.

Here is the part that follows directly from the previous section and is easy to get wrong. Specs are code, but they are *written* code: they are the intent layer, hand-authored, and the whole point of them is that a person decided them. The graph should connect them to the structure layer, and a machine should check that the connection holds. It should not generate them. A spec derived from the implementation is a transcript, not a spec.

### Honest status: what works today and what does not

I tested this while writing it, and the result is worth stating.

**Works today.** `tg` links code to sections of a `lat.md/` folder with typed edges, and builds `Section`, `CodeFile` and `CodeSymbol` nodes into one queryable graph. `tg check` verifies the links and, with `require-code-mention`, that every leaf section of a test-spec file is referenced from code. This repository uses both: `lat.md/` for architecture and test specifications, and OpenSpec for the change workflow. The roadmap names the OpenSpec change that implemented each release.

**Does not work yet.** A `@tg:` annotation cannot point at a file under `openspec/`. I tried `[[openspec/specs/auth/spec.md]]` as a target and `tg check` reported it as unresolved ("no matching section found"), because link targets are sections in the `lat.md/` folder or source files with symbols, not arbitrary Markdown elsewhere in the repo. And a typed `refines:: [[...]]` line written inside a `lat.md/` section shows up in `tg cypher` as a plain `references` edge; the types come from `@tg:` annotations in code. In the Obsidian plugin, where a vault is made of notes, typed edges and `type:` frontmatter labels work in notes as written.

So today, OpenSpec requirements are part of your *repository* but not yet nodes in the *CLI's graph*. The pragmatic bridge is to keep one `lat.md/` section per capability that names the OpenSpec capability and links to the code, and to use the vault or the Obsidian plugin to see specs as notes. Making `openspec/specs/**/spec.md` a first-class source of `Spec` and `Requirement` nodes is the obvious next feature, and I would rather say so than imply it exists.

### Specs can be tagged, and should be

Because a spec is a plain Markdown file, it can carry metadata, and that is the cheapest useful step you can take right now. Frontmatter gives you two things a graph can use immediately:

```
---
type: Spec
tags: [auth, security, p1]
status: stable
owner: platform
---
# auth Specification
```

- **`type`** becomes the node's label, so a query can say `MATCH (s:Spec)` instead of "some Markdown file". A list gives several labels. In a vault this labels the note. In a `lat.md/` folder it labels every section below the file's title, so a file of decisions with `type: Decision` gives you `MATCH (d:Decision)`. The vault graph model also supports configurable fallbacks that map a folder or a tag to a type when the frontmatter is absent.
- **Tags** are the orthogonal axis. Types say *what kind of thing* it is. Tags say which concerns it touches: a capability, a risk class, a team, a release. You will want to ask "show me every `security` spec that has no test", and that is a tag filter combined with a graph traversal.

A habit that pays off: tag specs by **capability** (what area), **risk** (what happens if it's wrong) and **status** (draft, stable, deprecated). Those three cover most of the questions people ask in practice.

---

## A small ontology for code

If you are going to type your graph, the first question is: which types? This is where most efforts go wrong. The temptation is to model everything, producing thirty node types and sixty edge types, and then nobody uses them, because every annotation becomes a taxonomy exercise.

The opposite failure is also real. If every edge is `related_to`, you are back to untyped links.

The rule I'd suggest: **a type earns its place only if you would ask a question that depends on it.** If you can't name the query, drop the type. What follows is a deliberately small starting set, six kinds of intent node and eleven kinds of edge, designed around the questions engineers and agents actually ask.

To be clear about the status of what follows: this is a **convention**, and in the next release it ships with the tool. `tg init --write` installs it as two files: a guide note, `lat.md/code-ontology.md`, and a Typed Graph Schema, `ontology/code-types.md`. A [follow-up article](code-ontology-in-practice.md) shows how each role uses them.

It is still a convention and not an enforced rule. Edge types are free-form in the syntax (the word before `::` is whatever you write), and node types are whatever you put in `type:`. `tg check` does not reject an unknown edge name. The schema is what an Obsidian vault validates against, what exports to SHACL for other tools, and what an agent reads to stop inventing synonyms. The files are yours after the first run: `tg init` never overwrites them.

### The two layers

Split the nodes into two layers and keep them apart in your head.

**Intent layer** (written by people):

- `Decision`: a choice that was made, with its reason and the alternatives rejected. The unit of "why". An ADR is a `Decision`.
- `Requirement`: something the system SHALL do. This is the OpenSpec requirement, one level below a whole spec file.
- `Scenario`: a concrete, checkable example of a requirement (WHEN/THEN). The bridge between prose and test.
- `Constraint`: something the system must not violate, usually from outside: a regulation, an SLA, a platform limit, a security rule. Differs from a requirement in that nobody chose it.
- `Concept`: a domain term with an exact meaning, so "account", "tenant" and "workspace" stop being used interchangeably.

**Realization layer** (derived, or annotated in place):

- `Module`/`CodeSymbol`: the code. Derived, never written by hand.
- `Test`: a symbol that runs against a requirement or a scenario.

Plus one thing that is neither: a `Change`, the unit of work that moves the intent layer and the code together. In OpenSpec that is a change folder with a proposal, design and tasks. It is the only node that has a lifecycle: proposed, applied, archived.

That is the whole node vocabulary. It is intentionally missing `Service`, `Team`, `Ticket`, `Epic` and the like. Those are real, but they are the answer to a different set of questions and they live well in other systems.

### The edges that matter

Here is the edge vocabulary, grouped by the question each one answers.

**"Is it built, and does it work?"**

- `implements` (code → requirement or decision): this code realizes that intent.
- `verifies` (test → requirement or scenario): this test proves that claim.

These two are the backbone. With only these, you already get coverage questions: a requirement with no `implements` is unbuilt, and one with an `implements` but no `verifies` is untested.

**"Does it agree?"**

- `contradicts` (negative sign, code or doc → decision, requirement or constraint): this disagrees with that, and we know it. Written as `-contradicts::`. This is the honest way to record technical debt, because it names *what* the debt is against.
- `supersedes` (decision → decision): this replaces that. Keeps history navigable and answers "is this decision still live?".

**"Why is it this way?"**

- `motivated_by` (decision → constraint or concept): the reason behind a choice.
- `constrains` (constraint → requirement or code): what rules bind this part.
- `refines` (requirement → requirement, scenario → requirement): this is a more specific version of that.

**"What does it touch?"**

- `depends_on` (requirement → requirement, code → requirement): a real dependency of intent, not an import.
- `defines` (concept → anything): where a term is given its meaning.

**"How did it change?"**

- `introduced_by` / `changed_by` (anything → change): ties a requirement or decision to the change that created or altered it. In OpenSpec terms, the archived change is the provenance.

Eleven edge types, counting `introduced_by` and `changed_by` separately. A useful sanity check on any vocabulary like this is to count how many of them you can explain with a one-line query. For these, you can.

### Using the sign and the properties

The two features untyped links can't offer are worth using on purpose.

**Sign.** Reserve the negative sign for *disagreement*, and keep it that way. `-contradicts` is the obvious one. A team that uses `-` for anything else dilutes the signal. If a dashboard shows red dashed lines, they should mean "something here is wrong or knowingly wrong".

**Properties.** Put facts about the *relationship* on the relationship. Examples that earn their keep:

```
// @tg: implements:: [[auth#Token expiry]] {since: "2.3", confidence: "partial"}
// @tg: -contradicts:: [[design#Stateless sessions]] {until: "2026-Q4", ticket: "PLAT-481"}
```

`since` makes a graph answer "what changed in 2.3". `until` and `ticket` turn a contradiction from a shame into a tracked item with an expiry. `confidence: partial` is how you say "this implements the happy path only", which is more honest than either claiming full coverage or not linking at all.

### Worked questions

A vocabulary is only as good as the questions it makes cheap. With the sets above:

*What requirements have no code?* A requirement with no incoming `implements`.

*What is built but unproven?* Requirements that have an `implements` but no incoming `verifies`.

*What are we knowingly doing against our own decisions?* Every `-contradicts` edge, sorted by its `until` property so the expired ones come first.

*What is the blast radius of changing this constraint?* Walk `constrains` outward, one to three hops, and list the code at the end.

*Which decisions are dead?* Decisions with an incoming `supersedes`.

*Show me everything tagged `security` that is not covered by a test.* A tag filter on the requirement, plus the missing-`verifies` pattern.

The first query in the article, "sections that nothing implements", is the real command today. The others are the same shape with a different edge type. Because the query language is openCypher, anyone who has used Neo4j reads them without learning anything new, and a coding agent that can call `tg_cypher` over MCP can ask them directly instead of grepping.

---

## What it costs, and where this does not fit

A fair account has to include the price.

**You write more.** A generator would write less. Typed annotations are one more thing to learn and one more thing a code review has to look at. I think it is worth it for the same reason tests are: it is the only part of the system that is not a function of the code. But it is a cost, and on a weekend project it is not worth it.

**Regex-based symbol finding is imprecise.** `tg` finds code symbols with small regex finders for TypeScript and JavaScript, Python, Go, Rust and C. They are fast and have no native dependencies, but a grammar-based parser is more precise, and unusual syntax, macros and generated code can slip past. When a file looks unbalanced, `tg` says it cannot tell instead of guessing. lat.md, the tool it is compatible with, parses with real grammars and has had far more real-world use, so for grammar-accurate links across many languages it is the stronger choice.

**If you only need checked links, plain links are enough.** Typing pays off when you want to *ask* the graph things, or when you want contradiction and verification recorded as separate facts. If neither is true for you, the untyped format is simpler and costs nothing extra.

**The ontology above is a starting point, not a standard.** It is small on purpose and it has not been battle-tested across many teams. Expect to rename half of it. It is declared in the open TGS format, so renaming means editing one note, and the result still exports to SHACL.

**Typed edges between two sections stay plain links in the CLI.** The `@tg:` syntax types the edge from code to a section. A line like `supersedes:: [[x]]` inside a `lat.md/` section is a `references` edge in `tg cypher`. Decision-to-decision relations are typed in an Obsidian vault, where the plugin reads them.

**OpenSpec files are not yet graph nodes in the CLI.** As covered above, today you bridge them through `lat.md/` sections and tags. That is a real gap.

---

## How to start

Don't start with the ontology. Start with five sections.

1. Pick the five things you most often explain to new people, or to your agent. Write each as a short section: one sentence of what it is, a few lines of why.
2. Link two or three functions to each with `@tg: implements::`. Link one test with `verifies::`.
3. If you use OpenSpec, add `type: Spec` and a few tags to the spec files you care about most.
4. Run `tg check`, then one query for "sections with nothing implementing them".
5. If the output told you something you did not already know, write five more. If it didn't, stop and use the plain format.

```
npm install -g @typedgraph/cli
cd your-project
tg init          # dry run: prints a diff, writes nothing
tg init --write  # agent files, hooks, skills, and the code ontology
tg check
tg cypher --code annotated "MATCH (c:CodeSymbol)-[r]->(s:Section) RETURN c.symbol, type(r), s.title"
```

`tg init` sets the project up for Claude Code, Cursor or any agent that reads `AGENTS.md`. It writes nothing without `--write`, adds the code ontology note and schema (skip them with `--no-ontology`), and installs a prompt hook that reminds the agent to search the docs before it works and a stop hook that blocks it from finishing when the check fails or when it changed a lot of code without touching the docs.

---

## The point

The old picture of documentation was a separate artifact that described the code from the outside, and that kept falling behind. The new picture, which spec-driven workflows are already moving toward, is that the intent is part of the repository: reviewed, versioned and built against like everything else.

A typed graph is what makes that picture checkable. It gives intent and implementation the same address space, gives each connection between them a meaning, and gives a machine enough to tell you when the two have stopped agreeing. What it asks of you is the one thing that cannot be automated: deciding, in writing, what the code is supposed to be.

Everything else, the structure, the symbols, the call edges, the index and the checking, the machine can do. Let it.

---

*Typed Graph and the `tg` CLI are open source (MIT). Docs and the other articles are at [volland.github.io/obsigraph](https://volland.github.io/obsigraph/). lat.md is a separate project by Yury Selivanov, and Typed Graph is not affiliated with it. OpenSpec is a separate project, and nothing here implies it is affiliated either.*
