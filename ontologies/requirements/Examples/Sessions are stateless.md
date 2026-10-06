---
type: Decision
status: accepted
date: 2026-01-20
owner: platform
---
The API keeps no server-side session. Rejected: a Redis session store, because it adds a failure point to every request.

## Links

motivated_by:: [[Uptime SLA]]
