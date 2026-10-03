---
lat:
  require-code-mention: true
---
# Schema Notes Tests

Test specifications for type schemas declared in notes, described in [[graph-model#Schema notes]], covering every scenario in the schema-notes spec.

## Schema found by location

A note directly inside the schema folder is the schema for the type named by its title; nested or outside notes are not schemas.

## No schemas no effect

Without schema notes there are no schemas, no diagnostics and no validation output.

## Property declarations read

Properties declared as a map, a kind shorthand or a list are read with kind, default and required flag.

## Unknown kind becomes text

An unsupported kind falls back to text and produces a diagnostic naming the schema note and the property.

## Disallowed edge reported

An edge whose type is missing from the source type's allow-list is reported at its line; a schema without a list allows every edge type.

## Missing required property reported

A note lacking a required property gets a diagnostic naming the property, and stays in the graph.

## Multi-label merge

For a multi-label note the first declaration of a property wins and allowed edge lists are combined.

## Template applied

A note created from a type has `type`, every declared default (scalars and lists) and the template body.

## Schema changes apply live

Editing a schema note changes the next validation result without rebuilding anything else.

## Scaffold is a valid schema

The scaffold for a new schema note parses without diagnostics and leaves edges unrestricted.
