## Traceability with tg

This project traces OpenSpec requirements to code with `tg` (see the `tg-trace` and `tg-impact` skills). While implementing each task:

- Before editing existing code, check what it already promises: `tg cypher --code annotated "MATCH (c:CodeSymbol {path: '<file>'})-[:implements]->(r:Requirement) RETURN c.symbol, r.requirement"`.
- Requirements of this change resolve at once as pending: put `// @tg: implements:: [[openspec:<capability>#<Requirement>]]` directly above each function or class you write that realizes a requirement (entry points only, 1 to 3 per requirement).
- Put `// @tg: verifies:: [[openspec:<capability>#<Requirement>#<Scenario>]]` directly above the `it(...)` or `test(...)` that proves each scenario.
- If a new capability is explained in lat.md, add it to that file's `openspec:` frontmatter.
- After each task: `tg check` must pass. When all tasks are done, `tg trace <capabilities> --gaps` should list nothing this change was meant to cover; report anything left, do not hide it.
