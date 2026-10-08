## Context

The project keeps requirements in OpenSpec (`openspec/specs/*/spec.md`), design and test specs in `lat.md/`, and ties code to lat.md with `@lat:`. lat.md parity forbids extending `@lat:` targets or adding links to lat.md prose that `lat check` would reject. `@tg:` is ignored by lat, already parses `[[openspec:x#y]]` targets, and the bundled code ontology declares `Requirement`, `Scenario`, `implements` and `verifies`.

## Goals / Non-Goals

**Goals:** requirement-level traceability from code, tests and docs to OpenSpec; broken trace links fail `tg check`; one command shows gaps; no change to OpenSpec files or the lat.md format.

**Non-Goals:** editing OpenSpec files from tg; trace data in the Obsidian plugin or VS Code extension (later); enforcing coverage in `tg check`; MODIFIED/REMOVED delta semantics beyond what is needed to resolve ids.

## Decisions

**A scheme prefix, not a new folder in the lattice.** Targets are `openspec:<capability>#<requirement>[#<scenario>]`. The prefix keeps OpenSpec ids out of lat.md id space, so short-id resolution and `lat check` parity are unaffected. Alternative, indexing `openspec/` as extra lat.md files, was rejected: spec headings (`Requirements`, `Requirement: X`) would make ids like `spec#tg-check Specification#Requirements#Requirement: Check` and collide across capabilities.

**Matching is case-insensitive with whitespace collapsed**, the capability is the folder name and the requirement is the text after `Requirement:`. Requirement names are already unique within a capability (OpenSpec validates this).

**Active changes count.** Requirements ADDED or MODIFIED in `openspec/changes/<change>/specs/<capability>/spec.md` resolve too, marked `pending` with the change name, so code written while a change is open can be annotated before archive; archiving keeps the same id. When a change MODIFIES a requirement the main one wins, and scenarios the change adds are merged into it. REMOVED and RENAMED requirements stay resolvable until archive and are listed in `removedBy`, which `tg trace` shows. Archived changes are ignored.

**Docs link by frontmatter.** A lat.md file declares `openspec:` as a list of capability or `capability#requirement` ids. The file's root section gets `references` edges to every named requirement (all requirements of a named capability). File-level granularity is enough for docs and keeps lat.md prose free of links lat would reject.

**Test-call attachment.** Tests are `it(...)` calls, not declarations, so today a `@tg:` comment above one falls back to the file with a warning. When the next non-blank line within the attach window starts a call to `it`, `test`, `describe` (optionally `.each`/`.skip`/`.only`), the annotation attaches to the file without a warning and each edge gets a `test` property with the call's first string argument.

**Trace verdicts.** A requirement is *implemented* when an `implements` edge targets it or one of its scenarios; *verified* when every scenario has a `verifies` edge, or the requirement itself has one and it has no scenarios; *documented* when a lat.md file names it. `tg trace` is report-only by default; `--strict` exits 1 on any unimplemented requirement or unverified scenario, for CI once coverage is complete.

**Graph shape.** `Requirement` nodes (`requirement` id, `capability`, `name`, `text`, `file`, `line`, `status` active|pending, `change`) and `Scenario` nodes (`scenario` id, `name`, `file`, `line`), with `contains` from requirement to scenario. Annotation edges keep their type, so `MATCH (c:CodeSymbol)-[:implements]->(r:Requirement)` works.

## Risks / Trade-offs

- [A requirement renamed in a change breaks annotations on archive] → `tg check` reports the target with a fuzzy suggestion; the archive step runs `tg check`.
- [Two comment lines per test (`@lat:` and `@tg: verifies::`)] → accepted; they answer different questions (which test spec, which requirement). A later option could derive one from the other.
- [Annotation noise in source] → annotate entry points of a requirement (1–3 symbols), not every helper.
