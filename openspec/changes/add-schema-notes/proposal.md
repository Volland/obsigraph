## Why

Types today are only a frontmatter label. Authors cannot declare what a Person has, which edge types are valid, or how a new Person note should look. Schema notes make types first-class and optional. See lat.md/graph-model (Schema notes).

## What Changes

- Recognize schema notes in a configurable folder (default `Types/`), one note per type, named after the type.
- A schema note declares properties (name, kind, default, required), allowed edge types, a template body and an optional visualization block.
- Creating a note from a type applies its template: frontmatter `type`, property defaults and the template body.
- Validation produces diagnostics (missing required property, disallowed edge type) but never blocks the graph from building.
- Assumptions: schemas are declared in the schema note's frontmatter under a `schema:` key (keeps the Properties panel usable) and the template body is the note body below the frontmatter; validation is advisory only; a schema for a type applies to all notes carrying that label; multi-label notes merge schemas in label order with the first declaration winning.

## Capabilities

### New Capabilities
- `schema-notes`: Declaring type schemas in notes, validating against them and creating notes from a type template.

### Modified Capabilities

## Impact

- New schema reader in `packages/core`, a create-note-from-type command and diagnostics surface in `packages/plugin`.
- Depends on `graph-model` and `edge-parsing`. Supplies the visualization block consumed by `add-visualization-config`.
