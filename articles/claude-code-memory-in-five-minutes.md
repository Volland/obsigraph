# Give Claude Code a memory in five minutes

*A hands-on setup: install the tg CLI, let `tg init` wire up Claude Code, write your first typed link, and see what the agent gets.*

---

## What you will have at the end

A project where Claude Code searches your design docs before it answers, can query a graph of docs and code, and is stopped from finishing while the documentation does not match the code. It needs Node.js, and you can use an existing project.

You do not need Obsidian, a database, a model or an API key.

## 1. Install the CLI

```
npm install -g @typedgraph/cli
```

`tg` is one bundled binary with no runtime dependencies.

## 2. Look before you write

```
tg init
```

With no flags, `tg init` is a dry run. It prints a diff of every file it would create or change and writes nothing. Read it. For Claude Code the managed pieces are a block in `CLAUDE.md`, hooks in `.claude/settings.json`, an entry in `.mcp.json`, and two skills, `tg-docs` and `tg-graph`. It also installs a small [code ontology](blog-code-ontology.html), a shared vocabulary for intent and code.

When it looks right:

```
tg init --write
```

The `CLAUDE.md` block sits between markers, so running it again replaces only that block. Use `--agent cursor` for Cursor or `--agent agents` for a plain `AGENTS.md`. If the project already uses lat.md, `--migrate` swaps its block, hooks and MCP entry, and leaves the rest of your files alone.

## 3. Write one design note

Create a `lat.md/` folder if `init` did not, and add a note about a decision that matters. For example `lat.md/auth.md`:

```
# Auth

How sessions and tokens work.

## Token expiry

Tokens expire after fifteen minutes and are refreshed on the next request.
```

Every section needs a short leading paragraph, and a folder needs an index file named `lat.md/lat.md` that lists its notes. `tg check` enforces both:

```
- [[auth]] — How sessions and tokens work.
```

## 4. Point the code at it

In the function that implements the decision, add a comment:

```
// @tg: implements:: [[auth#Token expiry]]
export function verifyToken(token: string) {}
```

`@lat: [[auth#Token expiry]]` also works if you only need a plain link. The `@tg:` form adds a type, an optional `-` sign for negative edges, and properties in braces.

## 5. Check it

```
tg check
```

It reports broken links, missing symbols, missing index files and sections without a leading paragraph, and exits non-zero on findings, so the same command works in CI.

## 6. Ask the graph

```
tg search "how are tokens validated"
tg cypher "MATCH (c:CodeSymbol)-[:implements]->(s:Section) RETURN s.title, count(c)"
```

Search is lexical by default, which needs no setup. Add Ollama or an OpenAI-compatible embeddings endpoint later for hybrid search. The Cypher query lists which design sections have implementations and how many.

## 7. Let the agent use it

Start Claude Code in the project. Three things now happen without you asking:

- When you send a prompt, a hook reminds the agent to search first, expands any `[[refs]]` in your prompt, and adds the top lexical hits.
- The agent can call the tools of `tg mcp`, including `cypher` and `edges`, for the graph.
- When the agent tries to finish, a stop hook blocks it if `tg check` fails, or if several code lines changed with little change in `lat.md/`.

Hooks run offline and always exit 0, so a hook failure never stops your session.

## Where to go next

- Add the check to CI: `tg check` as a step.
- Read [the code ontology](blog-code-ontology.html) to pick edge names your team shares.
- Keep notes in Obsidian? The [plugin](obsidian.html) opens `lat.md` links in place and draws code nodes in the graph.
- Coming from lat.md? See [the comparison](compare.html).
