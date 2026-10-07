# A shared space for agents and humans

*Why coding agents need the same documented, checked knowledge as the people they work with, and what that looks like in plain files.*

---

## Two readers, one set of facts

A team's knowledge has always had a human reader. Now it has a second one: a coding agent that starts every session knowing nothing about your decisions, your constraints, or why the auth module looks the way it does.

Most teams meet this as a chore. You re-explain the architecture. You paste the same context into every session. The agent confidently breaks something a design document warned about, because the document was never in its context, or was stale when it got there.

The usual fixes split in two. You keep notes for people, and you build a separate memory for the agent, in a vector store or a settings file nobody reviews. Now there are two sources of truth, and they drift apart.

## One space

TypeGraph takes the opposite position: the knowledge lives once, in Markdown files in your repository or vault, and both readers use it.

- A person writes it in Obsidian or in an editor, with the [Obsidian plugin](obsidian.html) or the [VS Code extension](install.html).
- An agent reads it through the `tg` command line or its MCP server, from Claude Code, Cursor or any MCP client.
- Both see the same files, so what the agent learns is a diff a person can review.

There is no export step and no second store. Everything else, the graph, the search index, the query engine, is derived from the Markdown and can be rebuilt from it.

## What makes it reliable

Shared is not enough. A shared space that rots is worse than none, because both readers trust it. TypeGraph adds three things.

**Typed links.** A plain link says two things are related. A typed edge says how: this function `implements` that design section, this note `contradicts` that decision, this spec `supersedes` the old one. Agents can traverse relationships and people can filter them, instead of both re-reading prose.

**A check.** `tg check` validates links, code symbols, section rules and test-spec coverage, with the same verdicts as lat.md, and exits non-zero on findings. Run it in CI and the documentation fails the build the day it stops matching the code.

**A gate for agents.** `tg init` installs hooks for Claude Code and Cursor. One searches the docs before the agent answers. The other blocks finishing while the check fails.

## What it is not

It is not a replacement for good writing. Intent is written by people, and a tool cannot generate the reason a decision was made from the code that resulted. TypeGraph gives that intent a structure, and makes sure it stays connected to the code.

It is not an alternative to lat.md so much as a superset of it. It reads the same `lat.md/` folders and agrees with `lat check`, then adds typed edges, openCypher queries, a graph view and an Obsidian plugin. lat.md is stronger in places, and [the comparison](compare.html) says where.

## Try it

For an agent, [set up Claude Code](agents.html) in a minute:

```
npm install -g @typedgraph/cli
tg init --write
```

For a vault, [install the plugin](obsidian.html) from the Obsidian community directory, or open the [live demo](demo.html) first.

Either way, start with a few typed links to the decisions that matter most. The graph grows from there, and so does what your agent knows.
