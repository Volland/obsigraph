## Traceability with tg

This project traces OpenSpec requirements to code and records its intent as a typed graph with `tg` (see the `tg-trace`, `tg-impact` and `tg-graph` skills). Use the graph while exploring:

- `tg ontology` lists the types and named relations this project records; the questions below use them.
- `tg trace <capability>` shows which requirements exist, which code implements them, which tests verify each scenario and which docs explain them; `--gaps` shows what is missing.
- `tg cypher --code annotated` answers questions across all of it: the code behind a requirement (`MATCH (c:CodeSymbol)-[:implements]->(r:Requirement {requirement: 'openspec:<capability>#<Requirement>'}) RETURN c.path, c.symbol`), why a decision exists (`MATCH (d:Decision)-[r:motivated_by]->(x) RETURN d.title, x.title, r`), what binds an area (`MATCH (k:Constraint)-[r:constrains]->(x) RETURN k.title, x.title, r.strength`), known debt (`MATCH (a)-[r:contradicts]->(b) RETURN a.title, a.symbol, b.title, r.ticket`).
- `tg search "<topic>"` finds the lat.md design sections; `tg section "<id>"` reads one.
- When an idea would change behavior that a requirement states, or overturn a recorded decision or constraint, name it and its code, so the proposal starts from what is true.
