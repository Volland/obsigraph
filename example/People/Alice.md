---
type: Person
role: research lead
joined: 2019-03-01
email: alice@acme.example
---
Alice runs search research at [[Acme]]. She met Bob in {{edge: alice-knows-bob . since}} ({{edge: Alice -knows-> Bob . label}}) and has mentored Dave since {{edge: Alice -mentors-> Dave . since}}.

Everything she knows about Bob, as a table:

{{edge: alice-knows-bob}}

## Team

knows:: [[Bob]] {since: 2020, label: "met at NeurIPS", id: "alice-knows-bob"}
knows:: [[Carol]] {since: 2018}
mentors:: [[Dave]] {since: 2024}
- works_at:: [[Acme]] {role: "research lead", since: 2019}
leads:: [[Search]], [[Crawler]]

## Research

authored:: [[Learning to Rank Notes]] {position: 1}
interested_in:: [[Graph Databases]]
interested_in:: [[Information Retrieval]]

## Trust

+trusts:: [[Bob]] {weight: 0.9}
-distrusts:: [[Mallory]] {id: "alice-mallory", why: "phishing email"}

Why she distrusts Mallory: {{edge: alice-mallory . why}}.
