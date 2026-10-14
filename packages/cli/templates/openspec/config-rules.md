# tg rules for openspec/config.yaml

`tg init` adds each list item below to the `rules` of the artifact named by its heading, prefixed `tg:` so later runs replace only these.

## proposal

- Under Impact, list the lat.md sections this change touches; find them with `tg search`, and name the requirements it adds or modifies as `[[openspec:<capability>#<Requirement>]]`.

## specs

- Give every requirement a stable, unique name: code, tests and docs cite it as `[[openspec:<capability>#<Requirement>]]`, and a renamed requirement breaks those links.
- Give every scenario a unique name within its requirement; tests cite it as `[[openspec:<capability>#<Requirement>#<Scenario>]]`.

## design

- Link the lat.md sections the design builds on with `[[section]]` references, and name decisions so a lat.md Decision section can record them.

## tasks

- For each requirement, include a task to annotate the code that implements it with a comment `@tg: implements:: [[openspec:<capability>#<Requirement>]]` on the line above the function, class or file.
- For each scenario, include a task to annotate the test that proves it with a comment `@tg: verifies:: [[openspec:<capability>#<Requirement>#<Scenario>]]` directly above the test call.
- Include a task to update the lat.md section that explains each capability and list the capability in that file's `openspec:` frontmatter.
- End with a task to run `tg check` and `tg trace <capability> --gaps` and close every gap they report.

<!-- Write annotation examples without a comment marker in front of the at-sign: tg check scans openspec/config.yaml as code and would read them as real annotations. -->
