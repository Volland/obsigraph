---
type: Scenario
lat:
  require-code-mention: true
---
# Frontmatter Edges Tests

Test specifications for [[edge-syntax#Frontmatter edges]] in the core graph store and schema validation.

## Links become typed edges

Single and list property values, aliases, subpaths and markdown links each yield an edge typed by the property name, with sign +1, line 0, no heading and no properties.

## Only links count

Text, numbers, booleans, null, empty `[[]]` placeholders and the `tags`, `aliases`, `cssclasses`, `type` and `types` properties yield no edges, and a missing frontmatter is fine.

## Off unless enabled

The graph has no frontmatter edges unless the `frontmatterEdges` option is on, and then has one edge per link with a derived id.

## Alongside body edges

A relation written in frontmatter and again in the body keeps both edges, and repeated links get distinct ordinals in their ids.

## Follows edits and unresolved links

Changing or removing a property replaces or removes its edge, and an unresolved target is a stub that disappears with the edge.

## Schemas check frontmatter edges

An edge type declaration with `from` and `to` produces a wrong-target-type finding for a frontmatter link to the wrong type, only when the option is on.
