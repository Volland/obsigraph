---
lat:
  require-code-mention: true
---
# Visualization Config Tests

Test specifications for style sources and precedence described in [[visualization#Styling]], covering every scenario in the visualization-config spec.

## Block header beats schema note

A block header color for a type wins over the schema note in that block only; other blocks keep the schema color.

## Schema note beats settings

When both a schema note and plugin settings set an attribute, the schema note wins and is reported as the origin.

## Attributes fall through independently

Each attribute resolves on its own, so a schema shape and a settings color combine; unset attributes use built-in defaults.

## Schema visualization applied

Color, shape and icon declared in a schema note's `visualization` block apply to that type.

## Label property

A declared label property replaces the note title as the node label when the node has that property.

## Edge type color

Edge types are styled from a schema's `visualization.edges` map and from settings, per attribute.

## Negative sign default

Negative edges are dashed red by default, and only an explicitly set attribute overrides that default.

## Bad value falls through

An invalid color or unknown icon is ignored with a diagnostic naming the source and attribute, and the next source supplies the value.

## Second label supplies shape

For a multi-label node, each attribute comes from the first label that supplies it.

## Schema edit restyles

Editing a schema note's color changes the resolved style on the next resolution without other changes.

## Header style scoped to block

`node.<Type>:` and `edge.<type>:` header lines parse into block-scoped style entries; malformed entries are header errors.

## Restyle keeps layout

An unchanged element set is detected so a refresh restyles elements in place instead of re-running layout.
