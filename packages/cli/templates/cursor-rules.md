---
description: Keep lat.md/ in sync with the code using the tg CLI
alwaysApply: true
---

- Before starting work, run `tg search` with a query describing the task and read relevant sections with `tg section`.
- Run `tg expand` on prompts containing `[[refs]]`.
- After every task, update `lat.md/` for any changed behavior, then run `tg check` until it passes.
- Link code to docs with `// @lat: [[section-id]]` or typed edges with `// @tg: implements:: [[section-id]]`.
- Every `lat.md/` section needs a leading paragraph of at most 250 characters.
