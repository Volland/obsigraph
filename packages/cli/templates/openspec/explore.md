## Traceability with tg

This project traces OpenSpec requirements to code with `tg` (see the `tg-trace`, `tg-impact` and `tg-graph` skills). Use the trace while exploring:

- `tg trace <capability>` shows which requirements exist, which code implements them, which tests verify each scenario and which docs explain them; `--gaps` shows what is missing.
- `tg cypher --code annotated` answers questions across all of it, for example the code behind a requirement: `MATCH (c:CodeSymbol)-[:implements]->(r:Requirement {requirement: 'openspec:<capability>#<Requirement>'}) RETURN c.path, c.symbol`.
- `tg search "<topic>"` finds the lat.md design sections; `tg section "<id>"` reads one.
- When an idea would change behavior that a requirement states, name the requirement and its code, so the proposal starts from what is true.
