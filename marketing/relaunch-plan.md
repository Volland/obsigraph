# TypeGraph relaunch: positioning, site structure, messaging, content plan

Written for: the TypeGraph team (founder, whoever builds the site and writes the articles).

## 0. Facts to fix before any copy ships

These come from the repo and `lat.md/publishing.md`. Each one can undercut the message if it is left alone.

| Issue | Today | Action |
|---|---|---|
| **Name** | Plugin is "Typed Graph" (Obsidian rules forbid "Obsidian" in the name). The VS Code extension is "TypeGraph". npm is `@typedgraph/cli`. The repo and URL still say `obsigraph`. | **Decided: TypeGraph**, written in prose as "TypeGraph" and in handles, domains and packages as `typedgraph` (matching `@typedgraph/cli`). Use it in every headline. Keep "Typed Graph" only as the Obsidian directory listing name, and rename the extension's display name to match if it differs. Move the site off the `/obsigraph/` URL to a `typedgraph` domain before the launch push, and check that the domain, GitHub org, npm scope and social handles are all available. |
| **"In a marketplace"** | The extension is live on both the VS Code Marketplace and Open VSX. | Say so. The site now links both. |
| **"More powerful than lat.md"** | The existing article `blog-tg-vs-lat-md.html` is an honest comparison and says where lat.md is stronger. | Make the claim as "a superset". `tg` reads the same `lat.md/` folders and gives the same `check` verdicts, and it adds typed edges, Cypher, a visual graph, vectors and MCP. Never say lat.md is bad. A claim you can verify gets repeated by developers. An inflated one gets screenshotted. Recheck against lat.md's current version first. |
| **"Reliable, documented"** | Real proof exists: the example vault is tested against the engine, `tg check` works as a CI gate, and builds are attested. | Use this as the evidence, not as an adjective. See the proof strip in section 3. |
| **Trademarks and legal** | The footer says "Not affiliated with Obsidian, LadybugDB or lat.md". The privacy policy assumes no third-party scripts or fonts. | Keep both. Do not add analytics or embeds without updating the Datenschutz page. |

## 1. Positioning

**Category claim:** TypeGraph is the shared workspace where humans and coding agents work from the same typed, checked knowledge graph.

**One-sentence version:** Your docs, your code and your agents' memory in one graph, written in plain Markdown, checked in CI, readable by people and by machines.

**Why it wins (three pillars):**

1. **Shared space.** The human writes `implements:: [[Token expiry]]` in Obsidian or an editor. The agent runs `tg cypher` or calls the MCP tool over the same file. There is no export, no sync and no second store. Markdown is the only source of truth.
2. **Documented and reliable.** Docs that fail the build when they drift: `tg check` for links, symbols and test-spec coverage, hooks that stop an agent from finishing with broken references, and signed and typed edges that record who contradicts what.
3. **Memory engineering, not note-taking.** Typed edges (`implements`, `contradicts`, `supersedes`) give an agent memory it can query, not a pile of text it must re-read. Query with Cypher, search lexically with no setup, add vectors when you want them.

**Against the alternatives (one line each):**
- Plain Obsidian: links without meaning. TypeGraph adds types, signs and properties.
- lat.md: an excellent doc and code checker. TypeGraph reads the same folders, then adds the graph, queries, visuals and a human-friendly editor.
- Vector-only memory or RAG: it retrieves by similarity. TypeGraph retrieves by relationship, and it can cite.

**Audiences and the one thing each must hear:**

| Audience | Job to be done | Hook |
|---|---|---|
| Obsidian power users | Make their vault queryable and useful to AI | "Your vault is already a graph. Give the links meaning." |
| AI and agent developers | Reliable memory and context for coding agents | "Memory your agent can query and your CI can check." |
| Product engineers | Keep specs, decisions and code aligned | "Specs that fail the build when the code drifts." |
| AI coders in Cursor, Windsurf and Claude Code | Install in a minute, no vault required | "`npm i -g @typedgraph/cli && tg init`. Done." |

## 2. Site structure

Today the home page serves everyone at once, starting with Obsidian. The new structure keeps one home page with a clear split, then gives each audience its own landing page.

```
/                      Home: shared space for agents and humans, 3-way audience split
/agents                For agents and AI coders: tg CLI, MCP, hooks, Claude Code/Cursor/Windsurf
/obsidian              For Obsidian users: plugin, typed edges, queries, graph view, demo vault
/teams                 For product engineers: docs-vs-code checks, CI gate, code ontology
/install               One page, every channel: Obsidian, Open VSX, VS Code, npm CLI, Claude Code
/demo                  Live demo (exists)
/docs                  Docs and CLI reference (exists)
/compare               TypeGraph vs lat.md, vs plain Obsidian, vs vector RAG
/ontologies            Gallery (exists)
/blog                  Articles (exists), tagged by audience
/changelog             Release notes, linked from every install block
```

**Navigation:** Obsidian · Agents · Teams · Docs · Blog · Install (primary button). Drop "Example" from the top nav and fold it into Obsidian and Demo.

**Home page, top to bottom:**

1. Hero with headline, sub-line and two buttons (copy in section 3).
2. **Install strip:** four tabs (Claude Code, Cursor and Windsurf, Obsidian, CLI) with a copyable command each. This is the aggressive part of the brief: the install path is visible before any scrolling.
3. Shared-space diagram: a human on the left editing Markdown, an agent on the right calling `tg` or MCP, the graph in the middle. Use the existing graph and demo rendering, not stock art.
4. Three pillars (section 1).
5. Audience split: three cards linking to `/obsidian`, `/agents` and `/teams`.
6. Proof strip: real terminal output of `tg check`, test counts for the engine, the build attestation, and the example vault whose every query is tested.
7. Compare teaser leading to `/compare`.
8. Articles (three featured) and the ontology gallery.
9. Final call to action with the install tabs repeated.

## 3. Messaging

### Home hero
**Headline:** A shared space for agents and humans.
**Sub-line:** TypeGraph turns your Markdown and your code into one typed, checked graph. You write it in Obsidian or your editor. Your agent queries it from Claude Code. Both see the same truth.
**Buttons:** `Install in 60 seconds` / `Try the live demo`
**Under the buttons:** Works with Obsidian · Cursor · Windsurf · VSCodium · Claude Code · any MCP client

### Install strip (aggressive version)
- **Claude Code:** `npm i -g @typedgraph/cli && tg init --write` installs hooks, instructions and skills. `tg mcp` serves the graph tools.
- **Cursor, Windsurf, VSCodium:** search "TypeGraph" in Extensions (Open VSX), or `codium --install-extension pavlyshyn.typegraph-vscode`.
- **Obsidian:** Settings, Community plugins, search "Typed Graph". Listed in the official directory.
- **VS Code:** use the VS Code Marketplace once it is live, otherwise the `.vsix`.

### Page messaging

**/agents** (headline: "Give your coding agent a memory it can query")
- "Stop re-explaining your architecture every session."
- `tg init` wires Claude Code and Cursor in one command. It is a dry run unless you pass `--write`, so nothing surprises you.
- The `tg mcp` server exposes eight tools. Agents run Cypher, lexical or hybrid search and GraphRAG with citations.
- Hooks make "docs match code" a gate the agent must pass before it declares a task done.
- The agent reads and writes plain Markdown, so a human can always review what it learned.

**/obsidian** (headline: "Your notes are a graph. Make the links mean something.")
- Typed, signed edges in one line, with properties. Your existing `type:: [[Target]]` lines keep working.
- openCypher query blocks and a graph view styled by your schema.
- "And now your AI can read it too": the same vault is the agent's memory through the sidecar or the CLI.
- Links: demo vault download, ontology gallery (Zettelkasten, library, requirements, agents).

**/teams** (headline: "Specs that fail the build when the code drifts")
- `tg check` is a CI gate with the same verdicts as lat.md.
- `@tg:` comments tie a function to the design section it implements.
- The code ontology gives developers, architects, product and agents one vocabulary.
- Cypher answers: which sections have no implementation, and which functions contradict the design.

### Proof strip (replace adjectives with these)
Use only numbers you can regenerate from a real run: tests passing, `tg check` output, build attestation link, example-vault test count, MIT licence, no telemetry and no third-party requests on the site.

### Tone
Specific, calm, builder-to-builder. Show a command or a result in every section. Avoid "revolutionary" and "supercharge". Say "memory engineering" and "graph engineering" sparingly, as the category terms they are, and always next to a concrete example.

## 4. Content plan

**Rule:** every article carries a run-it-yourself command, uses numbers from a real run (the existing articles already do this) and links to `/install`.

### Launch articles (weeks 1 to 4)

| Wk | Article | Audience | Job |
|---|---|---|---|
| 1 | "A shared space for agents and humans" (manifesto, 1,200 words) | all | The launch post. Defines the category and the three pillars. |
| 1 | "Give Claude Code a memory in 5 minutes" (tutorial) | agents | `tg init`, a hook, an MCP query, a before and after. The main acquisition piece. |
| 2 | "Your Obsidian vault as your AI's memory" | Obsidian | Plugin, sidecar and MCP. Targets the Obsidian crowd and r/ObsidianMD. |
| 3 | "TypeGraph vs lat.md: a superset, honestly compared" (refresh of the existing article) | agents, teams | Capture comparison searches. Recheck every claim first. |
| 4 | "Specs that fail the build: a docs-as-code CI gate" | teams | The reliability story with a GitHub Actions snippet. |

### Following articles (months 2 to 3, one every two weeks)
Memory engineering for coding agents (typed edges vs vector-only memory), Cursor and Windsurf setup guide, ontology recipes for agent teams, "what your agent should write down" (decision records as edges), a case study from your own use of TypeGraph on this repo (the repo already runs `lat.md` and `tg`), and an OKF export walkthrough.

### SEO targets (validate with a keyword tool before committing)
"obsidian knowledge graph plugin", "claude code memory", "cursor agent memory", "lat.md alternative", "mcp knowledge graph", "docs as code check ci". Give each its own page or article rather than one blended page.

## 5. Communications plan

**Pre-launch checklist (before any announcement):**
- [ ] One brand name and the new domain live, with redirects from the old URL.
- [ ] `/install` and `/agents` live. 60-second screencast of `tg init` in Claude Code recorded.
- [ ] Legal footer and privacy policy still accurate.

**Launch week sequence:**
1. Day 1: site live, manifesto article, GitHub release notes, social thread (screencast plus install command).
2. Day 2: Obsidian forum post and r/ObsidianMD (lead with the Obsidian article, not the agent story).
3. Day 3: Hacker News "Show HN" with the Claude Code tutorial. Founder is present for questions.
4. Day 4 to 5: posts in MCP and Claude Code communities, plus the Cursor and Windsurf forums for the Open VSX route.
5. Week 2 onward: one article per week, each reposted with a different hook per channel.

**Ongoing:** monthly release post tied to the changelog, a short demo video per feature, and a newsletter or RSS feed on the blog. Reach out to a handful of Obsidian and agent-tooling writers with the demo vault and a specific question, not a press release.

**Measure (privacy-compatible, no third-party scripts):** npm downloads, Open VSX installs, Obsidian plugin installs, GitHub stars and release downloads, demo vault downloads, MCP-related issues opened. Review weekly for the first month. Add website analytics only if you first update the privacy policy.

## 6. Open decisions for you

1. ~~Brand spelling~~ Decided: TypeGraph (`typedgraph` in handles and domains). Still open: which domain (for example `typedgraph.dev` or `typedgraph.io`).
2. ~~VS Code Marketplace~~ Already published; the site links it.
3. Whether to ship the new site as a rebuild of `site/` (static HTML, same pipeline) or restyle in place. The static pipeline in `site/build.mjs` is enough for this structure.
4. Appetite for the lat.md comparison. It is the strongest hook and the biggest tone risk.
