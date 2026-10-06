# Prompt and agent gallery ontology

A catalogue of prompts, agents, tools, skills, knowledge sources and evals, with the edges between them. Open this folder as an Obsidian vault with the Typed Graph plugin, or copy `Types/` into your own vault.

- **Types:** `Prompt`, `Agent`, `Tool`, `Skill`, `Knowledge`, `Eval`.
- **Edges:** `uses_prompt` (with `slot`), `calls_tool`, `has_skill`, `reads`, `delegates_to`, `derived_from`, `composes` (with `order`), `evaluated_by` (with `score`).
- **Questions:** which production prompts have no eval? Which autonomous agents can reach a destructive tool? Which prompt versions derive from a retired one?

```cypher
MATCH (a:Agent {autonomy: "autonomous"})-[:calls_tool]->(t:Tool {side_effects: "destructive"}) RETURN a.title, t.title
```

`Examples/` has a small support-desk setup so the graph is not empty on first open; delete it when you start.
