<h1 align="center">tg</h1>

<p align="center">
  <strong>Map, check and query your docs and code as one typed graph.</strong><br>
  A drop-in replacement for <a href="https://www.npmjs.com/package/lat.md">lat.md</a> that adds typed edges, openCypher queries and a code layer.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@typedgraph/cli"><img alt="npm" src="https://img.shields.io/npm/v/@typedgraph/cli?color=6d4fd9"></a>
  <img alt="Node 20+" src="https://img.shields.io/badge/node-%E2%89%A520-17c3b2">
  <a href="https://github.com/Volland/obsigraph/blob/main/LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-17c3b2"></a>
</p>

```bash
npx @typedgraph/cli init      # preview what it would set up in your project
```

## What it does

Teams keep the *why* of a project in markdown (architecture, decisions, specs) and the *what* in code. The two drift apart. `tg` keeps a `lat.md/` folder of linked markdown sections honest and ties your source code to it:

- **Check** that every `[[link]]` resolves, every code reference points at a real symbol, and every section follows the structure rules. Run it in CI or in an agent hook.
- **Annotate** code with the doc section it implements, as a plain link or a typed edge with properties.
- **Query** the whole thing, sections and code together, with read-only openCypher.
- **Search** sections lexically with no setup, or hybrid with embeddings when you configure a provider.
- **Serve** all of it to coding agents (Claude Code, Cursor, anything that speaks MCP) so they read the design before they write code.

It reads the same `lat.md/` folder as lat.md and gives the same `check` verdicts, so you can switch without rewriting anything, and switch back.

## Install

```bash
npm install -g @typedgraph/cli     # gives you the `tg` command
# or run without installing
npx @typedgraph/cli <command>
```

Requires Node 20 or newer. The package is one bundled file with no native dependencies.

## A 60-second tour

Start with a `lat.md/` folder next to your code. Each file is markdown with headings; each heading is a section you can link to.

```markdown
<!-- lat.md/auth.md -->
# Auth

How login works.

## Login

Credentials are checked, then a token is issued; see [[auth#Tokens]].

## Tokens

Tokens expire after an hour.
```

Point code at the section it implements:

```ts
// src/auth.ts
// @tg: implements:: [[auth#Login]] {since: 2}
export function login() {}
```

Now ask questions.

```text
$ tg check
Scanned 2 .md, 1 .ts in 8ms
All checks passed

$ tg edges
src/auth.ts#login:1  implements  [[lat.md/auth#auth#Login]] {"since":2}

$ tg section "auth#Login"
[[lat.md/auth#Auth#Login]] (lat.md/auth.md:5-8)
...
## This section references:
* [[lat.md/auth#Auth#Tokens]] — Tokens expire after an hour.

## Referenced by code:
* src/auth.ts:1

$ tg cypher --code annotated "MATCH (f:CodeSymbol)-[r:implements]->(s:Section) RETURN f.name, r.since, s.title"
f.name | r.since | s.title
-------+---------+--------
login  | 2       | Login

$ tg search "token expiry"
* Section: [[lat.md/auth#Auth#Tokens]] (lexical match)
  > Tokens expire after an hour.
```

## Commands

| Command | What it does |
| --- | --- |
| `tg check [md\|code-refs\|index\|sections]` | Validate links, code references, directory index files and section structure. Exit code 1 on findings. |
| `tg locate <name>` | Find sections by id, short id or fuzzy name. |
| `tg section <id>` | Show a section with its content, what it references and what references it, including code. |
| `tg refs <id>` | List the sections and code that reference a section. |
| `tg expand <text>` | Replace `[[refs]]` in text with their locations and context. |
| `tg search <query>` | Search sections. Lexical (BM25) by default, hybrid with embeddings when configured. |
| `tg reindex` | Rebuild the derived embedding cache in `.tg/`. |
| `tg cypher <query>` | Run a read-only openCypher query over the section graph, optionally with code (`--code off\|annotated\|all`). |
| `tg edges` | List `@lat` and `@tg` annotation edges (code to section) with type, sign and properties. |
| `tg init` | Set up `lat.md/`, agent instructions, hooks, MCP and skills. A dry run unless `--write`. |
| `tg gen <file>` | Print agent instructions: `agents.md`, `claude.md`, `cursor-rules.md`, `skill.md`, `graph-skill.md`. |
| `tg hook` | Handle agent hook events. Called by the hooks `init` installs, not by hand. |
| `tg mcp` | Start an MCP server over stdio so agents can call these commands. |
| `tg export <out>` | Project notes from an Obsidian vault into a `lat.md/` folder, with a loss report. |
| `tg import <path>` | Adopt an existing `lat.md/` folder by copy, or by symlink with `--mount`. |

Global options: `--dir <path>` (project root; default is the nearest `lat.md/` or `.tg/` above the current directory), `--json` (machine-readable output), `--no-color`, `--verbose`, `-V`, `-h`.

**Exit codes:** `0` success, `1` findings reported, `2` usage or internal error.

## Annotating code

Code points at documentation from a comment. Two forms:

```ts
// @lat: [[auth#Login]]                                  // a plain link, exactly like lat.md
// @tg: implements:: [[auth#Login]] {since: 2}           // a typed edge with properties
// @tg: -conflicts:: [[auth#Tokens]]                     // a leading "-" makes the edge negative
```

An annotation attaches to the declaration within three lines after the comment, otherwise to the file (with a warning). `@tg:` also works in block comments, JSDoc, `--` and `<!-- -->` comments. A section can require that code references it by adding `require-code-mention: true` to its file's frontmatter, and `tg check` then reports sections nobody points at.

## The code layer

Source files and symbols appear in the graph as derived nodes, never written to disk:

- `CodeFile` (`lang`, `lines`) and `CodeSymbol` (`name`, `kind`, `lang`, `path`, `symbol`, `lines`), with `contains` edges from files to symbols and classes to members.
- Annotation edges keep their type, sign and properties, so `implements`, `tests`, `deprecates` or any word you pick becomes queryable.
- `--code annotated` (the CLI default) keeps annotated symbols, what they point at and their files. `--code all` keeps every symbol. `--code off` drops code. `TG_CODE` sets the default.

Symbols are found with a regex finder for TypeScript/JavaScript, Python, Go, Rust and C. It masks comments and strings and tracks nesting, and when it cannot be sure it says "unresolvable" rather than reporting a false error. Only top-level symbols and one level of members are addressable, like lat.md.

## Set up your coding agent

```bash
tg init                      # dry run: prints a diff of every file it would create or change
tg init --write              # apply
tg init --agent cursor       # or: --agent agents (AGENTS.md)
tg init --migrate --write    # replace an existing lat.md block, hooks and MCP entry
```

For Claude Code, `init` adds or updates a managed block in `CLAUDE.md` (between `%% tg:begin %%` markers, so re-runs touch only that block), `UserPromptSubmit` and `Stop` hooks in `.claude/settings.json`, a `tg` entry in `.mcp.json`, and two skills. It is idempotent, and it never rewrites anything outside its own markers.

The hooks search lexically only, so there is no network call in the hot path, and they always exit 0 so they never block your agent. After five or more changed code lines they remind the agent to update the docs.

`tg mcp` exposes `tg_locate`, `tg_section`, `tg_search`, `tg_expand`, `tg_check`, `tg_refs`, `tg_cypher` and `tg_edges`. All are read-only.

## Search

`tg search` works with no key and no network. To get hybrid lexical plus vector ranking, configure a provider:

| Variable | Meaning |
| --- | --- |
| `TG_EMBED_PROVIDER` | `ollama`, `openai` or `none`. Nothing is configured by default. |
| `TG_EMBED_MODEL` | Model name. Defaults to `text-embedding-3-small` for OpenAI. |
| `TG_EMBED_URL` | Base URL for Ollama or an OpenAI-compatible endpoint. |
| `TG_EMBED_KEY`, `TG_EMBED_KEY_FILE`, `TG_EMBED_KEY_HELPER` | API key as a value, a file path or a command that prints it. `LAT_LLM_KEY*` are accepted as aliases. Keys are never written to disk. |

Vectors are cached in `.tg/` (self-ignored by a `.gitignore` inside it) by content hash and model; `tg reindex` rebuilds them. If the provider fails, `tg search` falls back to lexical results with a notice.

## Compatibility with lat.md

`tg` re-implements lat.md rather than wrapping it. Same section ids, `[[wiki]]` and source links, `@lat:` comments, leading-paragraph rule (250 characters) and `require-code-mention` frontmatter. "Drop-in" is tested: a CI suite runs the reference `lat check` and `tg check` on this repository, on a seeded fixture and on a snapshot of the upstream project, and compares their findings.

One intentional difference: `.mts`, `.cts`, `.mjs` and `.cjs` files count as source files for `tg`. Typed edges, Cypher, search fusion and the code layer are additions on top; none of them changes the lat.md format, so a folder written for one tool works with the other.

## Using it with Obsidian

`tg` pairs with the [Typed Graph plugin](https://github.com/Volland/obsigraph) for Obsidian, which renders the same graph with edge labels, signs and styling. A `lat.md/` folder inside a vault is read in place, with nested-heading links working in Obsidian. `tg export` writes a vault subset as a `lat.md/` folder (typed edge lines flatten to plain links, and the loss report counts everything dropped); `tg import` goes the other way. Export is lossy on purpose, because lat.md has no equivalent of typed edges, and it refuses to overwrite a non-empty target without `--force`.

## More ways in

- **VS Code:** the [TypeGraph extension](https://marketplace.visualstudio.com/items?itemName=typedgraph.typegraph-vscode) shows typed backlinks for notes and code, and has a setup button that runs `tg init` for you.
- **Obsidian:** the Typed Graph plugin, with a live demo at [volland.github.io/obsigraph](https://volland.github.io/obsigraph/demo.html).
- **Docs and source:** [github.com/Volland/obsigraph](https://github.com/Volland/obsigraph). Design notes for this CLI are in `lat.md/cli.md` in the repository.

## License

MIT
