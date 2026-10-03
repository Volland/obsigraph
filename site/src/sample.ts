export const VAULT = `=== Types/Person.md ===
---
schema:
  properties:
    role: {kind: text}
  visualization: {color: "#7c5cff", shape: ellipse}
---

=== Types/Company.md ===
---
schema:
  visualization: {color: "#f5a524", shape: round-rectangle}
---

=== Types/Project.md ===
---
schema:
  visualization:
    color: "#17c3b2"
    shape: diamond
    edges:
      depends_on: {color: "#17c3b2", line: dotted}
---

=== People/Alice.md ===
---
type: Person
role: research lead
---
## Team
knows:: [[Bob]] {since: 2020, label: "met at NeurIPS"}
mentors:: [[Carol]] {since: 2023}
works_at:: [[Acme]]
leads:: [[Search]]
## Trust
-distrusts:: [[Mallory]] {id: "alice-mallory", why: "phishing"}

=== People/Bob.md ===
---
type: [Person, Engineer]
role: engineer
---
works_with:: [[Alice]] {project: search}
works_at:: [[Acme]]
contributes:: [[Search]] {hours: 120}
contributes:: [[Ranking]] {hours: 40}

=== People/Carol.md ===
---
type: [Person, Engineer]
role: engineer
---
works_at:: [[Initech]]
contributes:: [[Ranking]] {hours: 200}
+trusts:: [[Bob]]

=== People/Mallory.md ===
---
type: Person
role: unknown
---
knows:: [[Eve]]

=== Acme.md ===
---
type: Company
founded: 1999
---
partners:: [[Initech]] {since: 2021}

=== Initech.md ===
---
type: Company
founded: 2004
---

=== Projects/Search.md ===
---
type: Project
status: active
---
depends_on:: [[Ranking]]

=== Projects/Ranking.md ===
---
type: Project
status: research
---
`;

export interface Example {
  title: string;
  query: string;
}

export const EXAMPLES: Example[] = [
  {
    title: 'The whole graph',
    query: `height: 460

MATCH (a)-[r]->(b)
RETURN a, r, b`,
  },
  {
    title: 'Who works on what (table)',
    query: `view: table

MATCH (p:Person)-[c:contributes]->(proj:Project)
RETURN p.title AS person, proj.title AS project, c.hours AS hours
ORDER BY hours DESC`,
  },
  {
    title: 'Negative edges only',
    query: `MATCH (a)-[r]->(b)
WHERE r.sign = -1
RETURN a, r, b`,
  },
  {
    title: 'Two hops from Alice',
    query: `MATCH p = (a {title: "Alice"})-[*1..2]->(x)
RETURN p`,
  },
  {
    title: 'Team size per company',
    query: `MATCH (p:Person)-[:works_at]->(c:Company)
RETURN c.title AS company, count(p) AS people, collect(p.title) AS names
ORDER BY people DESC`,
  },
  {
    title: 'Engineers and their projects, restyled',
    query: `node.Engineer: color=#e5484d, shape=hexagon
edge.contributes: color=#e5484d, line=dashed

MATCH (e:Engineer)-[r:contributes]->(p:Project)
OPTIONAL MATCH (p)-[d:depends_on]->(q)
RETURN e, r, p, d, q`,
  },
  {
    title: 'Unknown links (stubs)',
    query: `MATCH (a)-[r]->(s)
WHERE s.stub = true
RETURN a, r, s`,
  },
];
