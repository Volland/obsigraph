---
type: Scenario
lat:
  require-code-mention: true
---
# TG Migrate Tests

Test specifications for `tg migrate`, the lat.md to typed graph migration described in [[cli#Migration]]. Fixtures are committed git repositories.

## Migrate command

Dry run and repeat behavior.

### Dry run

`--dry-run` prints the diff and the summary and changes no file.

### Idempotent

After a migration the project passes `tg check` and `tg ontology check`, and a second run has nothing to migrate.

## File typing

Types from paths and content.

### Decisions typed by name

Paths type files as Decision, Constraint, Concept, Requirement and Scenario, a file of SHALL and MUST sections becomes a Requirement, and index files stay untyped.

### Existing type kept

A file with a `type:` is never retyped.

## Link typing

Typed edges from plain links.

### Cued relation

A link whose sentence says "because of" becomes a `motivated_by` edge line at the end of the section's own text, and the prose link stays.

### Sentence scope

Two links on one line take their cues from their own sentences: one `motivated_by`, one `supersedes`.

### Ambiguous link left plain

A link with two candidates and no cue is reported with its file, line, section, candidates and sentence.

### Words, not substrings

"reasonable" is not the cue `reason`, so that link stays ambiguous, and a period inside `[[constraints#St. Louis hosting]]` does not cut the sentence before its "because".

### Clause scope

In a long sentence, a "because" outside the parenthesized group around a link is not its cue, while `(because of [[x]])` still is.

### No cue without infer

A single candidate without a cue is reported as `no cue`, and applied with `--infer`.

## Edge metadata

Properties added to edges.

### Strength from the sentence

A MUST sentence gives `constrains` `strength: must` but no `since`, which it does not declare, and a committed `motivated_by` gets its commit date as `since`.

### Undeclared property not added

With an ontology whose `motivated_by` declares no properties, the edge gets none.

## Code reference upgrade

`@lat:` comments become typed `@tg:` edges.

### Implementation upgraded

A comment to a Requirement becomes `implements` with `since`, one to a Scenario in an e2e test becomes `verifies` with `level: e2e`, one to a Concept stays, and the project still checks clean.

### Keep lat

`--keep-lat` writes the `@tg:` line above the kept `@lat:` line, and a second run does not add it again.

## Setup swap

The agent setup changes from lat to tg.

### lat block replaced

The lat block in `CLAUDE.md` becomes the tg block with the surrounding text kept, and the tg skills and code ontology are installed.

## Migration safety

Uncommitted work is protected.

### Symlink out of the project

A symlink in the docs folder that leads outside the project makes the migration exit 2 naming the paths, even with `--force`, and the outside file is unchanged.

### Dirty file refused

A file with uncommitted changes makes the migration exit 2 naming it and write nothing; `--force` migrates it.

## Migration report

What the migration tells people and agents.

### JSON for an agent

The JSON report has `typed`, `edges`, `upgraded` and `unresolved`, each unresolved entry with its seven fields, and the text summary counts links left plain by reason.
