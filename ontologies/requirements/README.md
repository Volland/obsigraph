# Requirements ontology

Coding and requirement management in one graph: what the product SHALL do, why, for whom, in which release and what could go wrong. Open this folder as an Obsidian vault with the Typed Graph plugin, or copy `Types/` into your own vault.

- **Types:** `Requirement`, `Scenario`, `Decision`, `Constraint`, `Concept`, `Change`, `Stakeholder`, `Release`, `Risk`.
- **Edges:** `refines`, `depends_on`, `requested_by`, `ships_in`, `contradicts` (dashed red), `supersedes`, `motivated_by`, `constrains`, `defines`, `threatens`, `mitigated_by`, `introduced_by`, `changed_by`.
- **Questions:** which must-have requirements have no release? Which open risks threaten stable requirements? What is knowingly in conflict?

```cypher
MATCH (r:Requirement {priority: "must"}) OPTIONAL MATCH (r)-[e:ships_in]->(v:Release) WITH r, count(e) AS n WHERE n = 0 RETURN r.title
```

For a code project, `tg init --write` installs the smaller code ontology and lets you link functions and tests to requirements with `@tg:` comments; see "One vocabulary for the whole team" on the blog.
