## Traceability with tg

This project traces OpenSpec requirements to code with `tg` (see the `tg-trace` skill). While writing the change:

- Before proposing, run `tg trace <capability>` for each capability you touch, and `tg search "<topic>"` for the lat.md sections that explain it. Build on what is implemented; mention gaps you find.
- Requirement and scenario names become ids that code points at (`openspec:<capability>#<Requirement>#<Scenario>`). Choose short, stable, specific names. In MODIFIED deltas **keep every existing requirement and scenario name exactly**, and add scenarios instead of renaming them.
- Give every requirement at least one scenario a test can prove; each scenario will get a `@tg: verifies::` line on its test.
- In `tasks.md`, add a final task: "Annotate code with `@tg: implements::` and tests with `@tg: verifies::`; `tg check` and `tg trace <capabilities> --gaps` show no new gaps."
- If the change adds a capability, plan which lat.md file will name it in its `openspec:` frontmatter.
