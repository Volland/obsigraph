# Specs that know where their code is

*How we connected 239 OpenSpec requirements to the code that implements them, the tests that prove them and the docs that explain them, what an honest audit found on the way, and the small command that now keeps the three from drifting apart.*

---

## Three places the truth lives

A codebase that is built with coding agents tends to grow three kinds of text.

**Requirements** say *what* the system must do. In this repository they live in [OpenSpec](https://github.com/Fission-AI/OpenSpec): one folder per capability, each with a `spec.md` of requirements written as SHALL sentences and scenarios written as WHEN and THEN. New work arrives as a *change*, a proposal with spec deltas and a task list, and when the change ships it is archived and its deltas are merged into the specs.

**Design docs** say *why* and *how*. Ours are a [lat.md](https://www.npmjs.com/package/lat.md) folder: cross-linked Markdown sections about architecture, decisions and test specifications, checked by a tool so links never rot.

**Code** says what actually happens.

Each of the three is useful. The trouble is the gaps between them. A requirement can say one thing while the code does another. A design doc can describe a feature that was changed a month ago. A test can be named after a scenario it no longer exercises. Nobody notices, because nothing connects the three: you find out when a user files a bug, or when an agent reads a stale spec and writes code against it.

This article is about closing those gaps with typed links, and about what we found when we closed them in our own repository.

## The starting point: zero links

Before this work, the Typed Graph repository had 32 OpenSpec capabilities holding 212 requirements. It had a well-kept `lat.md/` folder: 37 test-specification files, 671 `@lat:` comments tying tests and code to it, and a `lat check` that passed.

And not one file in the whole repository mentioned `openspec`.

Code pointed at design docs. Tests pointed at test specifications. Requirements pointed at nothing, and nothing pointed at them. To answer "is this requirement implemented, and which test proves it?" you had to read the code. We could not answer it for one requirement without effort, let alone for two hundred.

There was a reason for that, and it was not laziness. lat.md links can only target sections inside `lat.md/` or symbols in source files. An earlier article on this blog said so plainly: a `@tg:` annotation could not point at a file under `openspec/`, and `tg check` reported it as unresolved. Requirements were simply not addressable.

## Step one: make a requirement addressable

The fix is an id. Every OpenSpec requirement already has a unique name inside its capability, and every scenario a unique name inside its requirement. So `tg`, the Typed Graph CLI, now reads `openspec/specs/*/spec.md` and accepts targets of this shape:

```
openspec:<capability>#<Requirement>
openspec:<capability>#<Requirement>#<Scenario>
```

The `openspec:` prefix matters. It keeps requirement ids out of the lat.md id space, so short-id resolution and parity with `lat check` are untouched. lat.md ignores `@tg:` comments entirely, so the two tools still agree on every finding.

Requirements in *open* changes resolve too, marked pending, so you can annotate code while the change that specifies it is still being written. When the change is archived, the id stays the same.

## Step two: say how code relates to a requirement

Typed Graph already had a grammar for typed links in code comments, the same one notes use: `type:: [[target]] {properties}`. It also ships a small code ontology whose edge types include exactly the two we needed:

- `implements`: this code realizes that requirement.
- `verifies`: this test proves that scenario.

So linking is two comment lines:

```ts
// @tg: implements:: [[openspec:vector-index#Mismatch blocks writes and offers rebuild]]
export function cosine(a: number[], b: number[]): number {
```

```ts
// @lat: [[tests/vector-index#Dimension change refuses queries]]
// @tg: verifies:: [[openspec:vector-index#Mismatch blocks writes and offers rebuild#Dimension changed]]
it('refuses search and retrieve with a rebuild error when the active dimension differs', async () => {
```

The second example shows a small rule we had to add. Tests are calls, `it(...)`, not declarations, so an annotation above one used to fall back to the file with a warning. Now an annotation directly above `it`, `test` or `describe` attaches to the file quietly and records the test's name on the edge. The `@lat:` line says which test specification the test belongs to, and the `@tg:` line says which requirement it proves. They answer different questions, so both stay.

Design docs link the other way, at file level, in frontmatter that lat.md ignores:

```yaml
---
openspec: [vector-index, embedding-provider, chunking-verbalization, sidecar-service]
---
# Vector Search
```

## Step three: check it, and report it

A link that can rot will rot, so `tg check` now resolves every `openspec:` target and every frontmatter entry. A typo is an error with a suggestion. Here is the real output from a three-file project where the requirement is called "Token expiry":

```
$ tg check
Scanned 2 .md, 1 .ts in 11ms

- src/auth.ts:1: @tg: [[openspec:auth#Token expiri]] — no requirement "Token expiri" in capability "auth" — did you mean '[[openspec:auth#Token expiry]]'?

1 error found
```

A missing link, on the other hand, is *not* an error. A project that has not traced anything yet must still pass `tg check`, or nobody would turn the feature on. Coverage is a separate question, answered by a new command:

```
$ tg trace
auth  1 req · 1 implemented · 0 verified · 1 documented
  ✗ Token expiry  — unverified
      implements  src/auth.ts#checkToken:1
      ✗ scenario  Expired token
      doc         lat.md/auth.md

1 requirement: 1 implemented, 0 verified, 1 documented
```

A requirement counts as *implemented* when an `implements` edge reaches it, *verified* when every one of its scenarios has a `verifies` edge, and *documented* when a design doc names it. `tg trace` exits 0 by default. With `--strict` it exits 1 while any requirement is unimplemented or unverified, which is the switch you flip in CI once coverage is where you want it. `--gaps` hides everything that is already complete.

## Step four: annotate two hundred requirements honestly

Writing `implements` comments by hand for 212 requirements would take days. Generating them from names would be fast and wrong. A function called `validateSchemas` might implement the schema requirement, or half of it, or something the spec no longer says.

So we audited first. Five agents worked in parallel, one per cluster of capabilities (edges and schemas, queries and graph views, the sidecar and vectors, the CLI, and integrations). For every requirement each agent had to read the code, not the names, and record:

- a status: implemented, partial, missing, or drifted (the code does something else);
- the implementing symbols, as `file#Class#method`;
- the tests that exercise each scenario;
- the design doc that explains it;
- what was wrong with the requirement text itself.

The results went into JSON, and a script turned them into comments: 727 annotations across 127 files, inserted directly above the declarations and test calls they describe. `tg check` validated every one of them. Coverage went from nothing to this:

| | Before | After annotation |
|---|---|---|
| Requirements implemented (traced) | 0 | 213 of 239 |
| Requirements verified | 0 | 197 of 239 |
| Requirements documented | 0 | 220 of 239 |

The remainder were mostly requirements from two changes nobody had implemented yet, which is exactly what a trace should show.

## What the audit found

The numbers were better than we feared and worse than we hoped. Of 212 requirements, **172 were implemented as written, 27 were partial and 13 had drifted**. None were missing outright. Drift came in three flavours, and each needs a different fix.

### The spec was stale

Twenty requirements described behavior that had since been changed on purpose: tested, documented in lat.md, released. The spec still said TGS 0.1 while the code, the published specification and the website said 0.2. The VS Code spec said a click expands a graph node, while the extension expands on right-click and opens on double-click. The SHACL export spec put a template body in `tgs:template`, while the code writes it to its own `tgs:templateBody`.

Here the code is right and the spec gets rewritten. One rule kept this safe: **never rename a requirement or a scenario**. Their names are now ids that code points at, so a rename would break hundreds of annotations. Wording changes, names stay.

### The code had a bug

Eleven requirements stated the right behavior and the code got it wrong. A few examples, each now fixed with a test:

- **NaN similarity.** When the embedding model changed to one with a different vector size, the query was embedded with the new model and scored against vectors from the old one. `cosine` happily returned NaN. The test missed it because both fake models in the suite produced 128-dimensional vectors. Search and retrieval now refuse with a rebuild message when dimensions differ, and `cosine` throws on vectors of different length.
- **No timeout.** The spec said `tg search` falls back to lexical results when the embedding provider times out. There was no timeout, so an unresponsive provider simply hung the command. Requests now abort after 30 seconds.
- **Wrong precedence.** The spec said the tool's own key variables win over the lat.md-compatible aliases. In code, `LAT_LLM_KEY` beat `TG_EMBED_KEY_FILE`.
- **Silent data loss.** Importing a SHACL shapes file into an existing multi-type note dropped the template body without a word. It now warns and names the layout that keeps it.
- **A corrupt file stops a service.** A Ladybug database that failed to open crashed the sidecar at startup instead of being rebuilt. It is now discarded and rebuilt, and if that fails too, the sidecar keeps serving with the mirror marked unavailable.
- **Serving old data quietly.** After a failed mirror sync, queries were answered from the previous snapshot with no notice. They now report the failure.

Eight more requirements were both: stale wording *and* a code fix.

### Nobody had decided

One requirement, and eight questions around others, had no right answer in the code or the spec. Should an embedding-model mismatch answer from the old index with a "stale" flag or refuse outright? Should VS Code keep expanded graph nodes when you switch files, as it did, or clear them, as Obsidian does? Should "nothing matched" exit with 1, the same code as "findings"?

An audit cannot answer these. It can only make them visible, which turned out to be one of its most useful outputs. Each one went into the change proposal with both options, and each got a decision recorded next to the requirement it changes.

### The things nobody wrote down

Four features had shipped with tests and no spec at all: typed note creation with generated ids and templates, the ontology gallery, the plugin install check and the example vault. They became four new capabilities, with scenarios taken from the tests that already existed, and those tests now carry `verifies` annotations.

## The workflow that came out of it

All of this went through OpenSpec itself, as two changes: one adding the trace feature, and one aligning the specs with the code and fixing the bugs. Both are archived now, and archiving merged 81 new requirements, 45 rewritten ones and one removal into the specs. The day-to-day loop is short:

1. **Propose.** A change adds or modifies requirements. Requirements in an open change resolve immediately, marked pending.
2. **Implement with links.** Put `implements` above the code that realizes a requirement and `verifies` above the test that proves each scenario. One to three entry points per requirement is enough; annotating every helper is noise.
3. **Check.** `tg check` rejects a link to a requirement that does not exist and suggests the nearest one.
4. **Trace.** `tg trace <capability> --gaps` shows what is still unimplemented or unverified before you archive.
5. **Archive.** The ids do not change, so every link keeps resolving.

Because requirements are also graph nodes, you can ask the graph questions the trace report does not. Which files carry the most requirements?

```
$ tg cypher --code annotated "MATCH (c:CodeSymbol)-[:implements]->(r:Requirement)
    RETURN c.path AS file, count(DISTINCT r) AS reqs ORDER BY reqs DESC LIMIT 5"
file                                          | reqs
----------------------------------------------+-----
packages/core/src/schema/schema.ts            | 15
packages/sidecar/src/ops.mts                  | 12
packages/core/src/cypher/exec.ts              | 11
packages/sidecar/src/vectors/vector-index.mts | 11
packages/core/src/embed/chunk.ts              | 10
```

That list is a map of where a change to the code is most likely to change what the product promises. Which code realizes one specific promise?

```
$ tg cypher --code annotated "MATCH (r:Requirement {capability: 'vector-index',
    name: 'Mismatch blocks writes and offers rebuild'})<-[:implements]-(c:CodeSymbol)
    RETURN c.path, c.symbol"
c.path                                        | c.symbol
----------------------------------------------+--------------------------
packages/core/src/embed/chunk.ts              | cosine
packages/sidecar/src/ops.mts                  | Ops#queryVector
packages/sidecar/src/ops.mts                  | Ops#search
packages/sidecar/src/vectors/vector-index.mts | VectorIndex#rebuild
packages/sidecar/src/vectors/vector-index.mts | VectorIndex#checkIdentity
```

The same graph is available to coding agents through the `tg_trace` and `tg_cypher` MCP tools, so an agent asked to change mismatch handling can find all five places before it edits one.

## What the gaps look like now

The trace is not complete, and it should not pretend to be. After archiving both changes the repository has 319 requirements, of which 219 are traced to code, 202 are verified scenario by scenario and 300 are named by a design doc. Most of the gap is the 81 requirements we just added to describe existing behavior; they need their `implements` lines. A slice of it is honest work left to do:

```
$ tg trace --gaps vector-index
vector-index  11 req · 9 implemented · 8 verified · 11 documented
  ✗ Incremental update per file  — unverified
      ...
      ✓ scenario  Note renamed  packages/sidecar/test/vectors.test.ts:215 "re-attributes vectors on a folder move without re-embedding unchanged text"
      ✗ scenario  File name changed
```

That last line is real: moving a note between folders reuses its vectors, but renaming the file re-embeds every chunk, because the file name is part of each chunk's context. The spec now says so, and the trace says no test proves it yet. That is the point. The gap is visible, it has an address, and anyone, human or agent, can pick it up.

## What we would tell another team

- **Make requirements addressable before you try to trace them.** An id built from names the team already uses beats a numbering scheme nobody remembers.
- **Audit before you annotate.** Generated links that encode the drift are worse than no links. The audit paid for itself in real bugs.
- **Never rename a requirement once code points at it.** Rewrite the sentence, keep the name.
- **Keep coverage out of the check.** Broken links fail the build; missing links show up in a report until you choose to enforce them.
- **Let undecided questions be visible.** The most valuable lines in our audit were the ones that said "nobody decided this".

The trace feature ships in the `tg` CLI. Requirements live in OpenSpec, design in lat.md, and the links between them in the comments right next to the code they describe.
