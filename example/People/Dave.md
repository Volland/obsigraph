---
type: Person
joined: 2024-06-01
---
Dave is an intern. His note has no `role`, which the Person schema marks as required, so *Show diagnostics* lists a warning for him. Validation is advisory: nothing is blocked.

works_at:: [[Acme]] {role: intern, since: 2024}
contributes:: [[Crawler]] {hours: 30}
knows:: [[Carol]]
