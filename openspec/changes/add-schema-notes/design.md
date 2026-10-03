## Context

Schema notes were sketched in lat.md/graph-model as optional typed templates. `graph-model` already derives labels from frontmatter; this change layers declarations on top without making them required. A schema note must remain an ordinary note a user can read and edit.

## Goals / Non-Goals

**Goals:** declare properties, defaults, allowed edge types and template per type; advisory validation; create-from-type; live updates.

**Non-Goals:** enforcing constraints (blocking writes), type inheritance, editing UI for schemas, visualization semantics (see `add-visualization-config`).

## Decisions

**Schema in frontmatter under a `schema:` key.** Keeps it queryable by the Properties panel and Bases. Alternative, a fenced code block in the body, was rejected as invisible to those tools. The template is the note body so it is plain markdown.

**Schema note is identified by folder plus title.** A configurable folder (default `Types/`) is cheap and predictable. Alternative, a `type: schema` frontmatter flag, was rejected as easy to forget; folder wins, but the flag may be added later as an additive override.

**Validation is advisory.** Diagnostics only, so imperfect vaults still render. Alternative, hard rejection, would break Graph Link Types compatibility.

**Multi-label notes merge schemas in label order, first declaration wins for each property.** Predictable and cheap; true inheritance is out of scope.

**Parsing lives in `core`, note creation in `plugin`.** Keeps `core` free of Obsidian APIs.

## Risks / Trade-offs

- [Schema syntax locks in early] -> versioned `schema:` key shape documented in lat.md; unknown keys ignored.
- [Diagnostics noise on large vaults] -> diagnostics are grouped per note and can be disabled in settings.
- [Folder convention surprises users] -> folder is a setting and the command palette offers a create-schema-note command.
