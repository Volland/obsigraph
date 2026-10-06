---
lat:
  require-code-mention: true
---
# SHACL Tests

Test specifications for exporting schema notes as SHACL and importing SHACL shapes, covering every scenario in the shacl-interop spec. See [[lat.md/shacl]].

## Export writes valid Turtle

Export produces one node shape per type that parses as Turtle, the same bytes on a second run, and prefixes only for an empty vault.

## Node type mapping

Types, kinds, cardinality, defaults, enums and declared URIs map to a target class and property shapes with the datatypes of the TGS mapping.

## Edge mapping

Per-type edges become property shapes with classes, `sh:or` for several targets, cardinality, and `tgs:edgesClosed` on the type.

## Edge type shapes

An edge type with endpoints and properties becomes a reification shape constraining predicate, subject, object and the edge's own properties.

## Annotations preserved

Note path, template link, template body and visualization are written as `tgs:` annotations.

## Import layouts

Import creates one note per type by default and a single note with `--layout single`.

## Existing body kept

Importing into an existing schema note replaces only its schema keys and leaves other frontmatter and the body unchanged.

## Mixed note protected

A note that declares types missing from the import is left unchanged and reported, unless forced.

## External shapes imported

Foreign SHACL with schema.org IRIs, `sh:node` edges and reification shapes imports as types, edges and edge types with `uri` set.

## Unsupported constructs reported

Constructs outside the TGS subset are listed with their shape, and the rest of each shape is still imported.

## Round trip is lossless

Export, import into an empty vault and export again gives byte-identical Turtle, and re-importing it changes no note.

## Schema commands

`tg schema export` and `tg schema import` write and read files, report counts and the drop report, and use exit codes 0 and 2 for success and bad input.
