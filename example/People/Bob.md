---
type: [Person, Engineer]
role: engineer
joined: 2020-09-14
language: Rust
---
Bob builds the search backend. His labels are `Person` then `Engineer`, so the Person style (purple ellipse) wins and the Engineer properties and edges are merged in.

knows:: [[Alice]] {since: 2020}
works_at:: [[Acme]] {role: engineer, since: 2020}
contributes:: [[Search]] {hours: 120}
contributes:: [[Ranking]] {hours: 40}
authored:: [[Learning to Rank Notes]] {position: 2}
reviews:: [[Typed Links in Practice]] {verdict: accept}
+trusts:: [[Carol]]
