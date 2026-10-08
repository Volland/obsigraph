---
lat:
  require-code-mention: true
---
# New Note Tests

Test specifications for identifiers and templates when notes are created from a type: the generators, the `id` key of a schema note, and the planner both Obsidian and VS Code use. See [[graph-model#Schema notes]].

## Generated ids

The id generators produce well-formed, unique ids from an injected clock and randomness.

### UUID versions

A version 4 and a version 7 UUID have the canonical 8-4-4-4-12 shape with the right version and variant digits, and the version 7 id carries the millisecond clock in its first 48 bits.

### Time-ordered ids sort

Version 7 UUIDs made at increasing times sort as plain strings in creation order, which is what makes them lexical ids.

### Timestamp id skips taken minutes

The timestamp id is `YYYYMMDDHHmm` in local time and moves forward a minute at a time while the id is in use.

### Luhmann siblings

The next sibling of `1a` is `1b`, of `1z` is `1aa`, of `3` is `4`, and used ids are skipped.

### Luhmann children

A child of `1` is `1a`, of `1a` is `1a1`, and a taken first child moves on to its next sibling.

### Luhmann roots and order

A new root is one more than the largest top-level number, and ids order as a slip box shelves them: `1`, `1a`, `1a1`, `1b`, `2`, `10`.

## The id key

A type declares the ids its new notes get with the `id` key of TGS 0.2.

### Id key forms

A bare kind, a mapping with `property`, `auto` and `filename`, and a list of mappings all read; a Luhmann id is not automatic unless it says so.

### Id property is implied

A property named by an id rule is declared as a text property when the type does not declare it.

### Invalid id declarations

An unknown kind, an unknown key, a list entry without a property and a repeated property are each reported and the entry is ignored.

## Planning a note

`planNewNote` builds the file name and content of a new note from a type, its template and the graph.

### Ids and tokens

Automatic ids land in the frontmatter and in the template as `{{id}}` and `{{<property>}}`, `{{title}}` and `{{date}}` are filled in, and other double-brace text such as edge embeds is left alone.

### Luhmann placement

A child or sibling of a parent note gets the next free Luhmann id, the parent tokens fill in, and the note is found from the active note's id.

### Lines without a parent are dropped

A template line that mentions a parent token disappears when the note has no parent, so no empty link is left behind.

### File name carries the id

A rule with `filename` prefixes the file name with the generated id.

## Zettelkasten ontology

The gallery ontology uses all of this.

### Zettelkasten ids and templates

Every Zettelkasten type gets a time-ordered `uid`, permanent notes also take an optional Luhmann id, and each note type has a template that produces a valid note.
