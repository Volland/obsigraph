# TypeGraph for VS Code

Typed backlinks and a graph view for the markdown and code in your workspace, with no Obsidian required.

## What you get

- **Backlinks panel.** Open a note and see every note that links to it, grouped by edge type (`knows::`, `blocks::`, ...), with the sign (`-distrusts::` shows as a minus) and edge properties. Click to jump to the line.
- **Code and spec together.** Open a source file and see the `lat.md` sections its `// @lat: [[...]]` annotations point at. Open a section and see the source files that point back at it.
- **Graph view.** `TypeGraph: Open Graph` shows the active file's neighborhood; right-click or long-press a node to expand it, double-click to open it.
- **New typed notes.** `TypeGraph: New Typed Note` creates a note from a type in your schema folder with its template and generated ids (UUID, time-ordered UUID, timestamp or Luhmann). `New Child Note` and `New Sibling Note` branch a Luhmann id from the active note. Nothing is written until you run a command, and nothing is overwritten.
- **Set up TypeGraph.** For projects without `lat.md/` or `tg` agent setup, one button runs `tg init` (a global `tg` if you have one, otherwise `npx @typedgraph/cli init`) in a visible terminal, after listing the files it will create or change and asking you to confirm.

## The `tg` CLI: lat.md, plus types

The extension reads the same files as [`tg`](https://www.npmjs.com/package/@typedgraph/cli) (`npm i -g @typedgraph/cli`), the command line that keeps a project's knowledge graph checked in CI and available to agents.

- **Drop-in for lat.md.** `tg locate`, `section`, `refs`, `expand` and `check` read the same `lat.md/` folder, section ids, `[[wiki]]` links and `@lat:` comments as [lat.md](https://www.npmjs.com/package/lat.md). A parity suite checks that `tg check` reports the same findings as `lat check`.
- **Typed links from code.** `// @tg: implements:: [[auth#Login]]` uses the same edge syntax as notes, so code, docs and specs form one typed graph.
- **Queries.** `tg cypher` runs openCypher over the section graph; `tg edges` lists annotations; `tg search` ranks sections lexically, or hybrid with embeddings.
- **Specs to code.** `tg trace` links OpenSpec requirements to the code that implements them, the tests that verify them and the docs that explain them, and reports the gaps.
- **Vault checks.** `tg validate` checks notes against their schema notes, with JSON or SARIF output for CI.

## Built for agentic flows

`tg init` (or the **Set up TypeGraph** button) prepares a project for coding agents: Claude Code, Codex, Cursor, GitHub Copilot, OpenCode, Kilo Code, Pi, Oh My Pi or any `AGENTS.md`-based agent. In a terminal it asks which agents you use and what to set up or update (`CLAUDE.md`/`AGENTS.md`/Cursor rules, hooks and MCP, skills, OpenSpec, code ontology), then writes and lists the files. `tg init --dry-run` only prints the diff.

- **Instructions and hooks.** A managed block in `CLAUDE.md` or `AGENTS.md`, plus prompt and stop hooks that point the agent at relevant sections and flag docs left stale by code changes.
- **MCP server.** `tg mcp` gives agents the same commands as tools: locate, section, search, refs, check, Cypher, edges and trace.
- **Skills in every agent's folder.** `tg-docs` keeps `lat.md/` in sync, `tg-graph` queries the section graph, `tg-trace` links requirements to code and tests, `tg-impact` finds what a change touches before and after the edit, and `tg-audit` turns spec drift into an OpenSpec change.
- **OpenSpec that annotates its own output.** tg rules in `openspec/config.yaml` make every generated task list annotate code with `implements`, tests with `verifies`, link the lat.md docs and end with `tg check` and `tg trace`.
- **Shared vocabulary.** A small code ontology (Decision, Requirement, Constraint, `implements`, `verifies`, ...) in `Types/`, with templates in `Templates/`, so **New Typed Note** creates a ready-to-fill Decision or Requirement.

The backlinks panel and graph view in this extension show what the agent sees.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `typegraph.schemaFolder` | `Types/` | Folder whose notes declare types, used by the New Typed Note commands. |
| `typegraph.roots` | `["."]` | Folders, relative to the workspace folder, that form the graph. |
| `typegraph.ignore` | `["node_modules"]` | Folder names skipped at any depth. Dot folders are always skipped. |

## Privacy

The extension reads files in your workspace and never writes to them. It collects no telemetry and makes no network requests; only the setup button, when you confirm it, runs a command that may download the CLI.

## Edge syntax

Typed edges look like `knows:: [[Bob]] {since: 2020}`; a leading `-` makes an edge negative. A note with `type: edge`, `from`, `to` and `edgeType` frontmatter is an edge note: it shows as an edge between its endpoints, not as a node. See the [project README](https://github.com/Volland/typedgraph) for the full syntax, the `tg` CLI and the Obsidian plugin.
