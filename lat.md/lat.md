This directory defines the high-level concepts, business logic, and architecture of this project using markdown. It is managed by [lat.md](https://www.npmjs.com/package/lat.md) — a tool that anchors source code to these definitions. Install the `lat` command with `npm i -g lat.md` and run `lat --help`.

- [[architecture]] — standalone plugin, monorepo layout and source-of-truth rule
- [[edge-syntax]] — inline typed, signed edges with properties, IDs and embeds
- [[graph-model]] — notes as typed nodes, schema notes and edges
- [[query-engine]] — openCypher subset, two backends and the graph-query block
- [[visualization]] — Cytoscape.js surfaces and type-driven styling
- [[ladybug-mirror]] — one-way disposable LadybugDB mirror
- [[vector-search]] — Ollama embeddings for node chunks and verbalized edges
- [[sidecar]] — headless Docker service exposing REST and MCP for RAG
- [[roadmap]] — phased delivery v0.1 to v0.4 and open questions
- [[tests]] — test specifications tied to test code
