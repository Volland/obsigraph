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

## Multi-type notes

One schema note can declare several types under `schemas:`, alongside the title type under `schema:`; notes in subfolders or outside the schema folder declare nothing.

## Property attributes read

Properties read `many`, `values`, `uri` and the `datetime` and `list` kinds.

## Edge map form

Edges declared as a map read target types, `many` and `required`, and a malformed `edges` value is reported.

## Edge types read

Edge types under `edgeTypes:` read endpoints, properties, `uri` and visualization.

## Duplicate types reported

A type declared in two notes uses the first by path and a diagnostic names both notes.

## Identifiers expanded

CURIEs expand with built-in and declared prefixes, full IRIs pass through, and an unknown prefix is reported.

## TGS version handling

A newer minor version reads with unknown keys reported; another major version is reported and its schema ignored.

## Value and cardinality validation

Values outside an enum, lists in single-valued properties, missing required edges and repeated single edges are reported.

## Edge property validation

Missing required and enum-violating edge properties are reported at the edge's line and undeclared properties are accepted.

## Edge endpoint validation

An edge to or from the wrong type is reported, while stubs and untyped notes are not.

## Template note used

A `template` link in a wikilink, markdown link or path form picks the template body ahead of the schema note's body.

## Template generated

A type with no template gets a generated one with property placeholders and edge lines that create no edges.

