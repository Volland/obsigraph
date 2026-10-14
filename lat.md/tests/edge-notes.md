---
type: Scenario
lat:
  require-code-mention: true
---
# Edge Notes Tests

Test specifications for [[edge-syntax#Edge notes]] in the core graph store.

## Edge note becomes an edge

A `type: edge` note yields one edge from `from` to `to` with its other frontmatter as properties, its path as id and itself as `file`, and no node; its body adds no edges.

## Pinned id and sign

A `-` prefix on `edgeType` makes the edge negative, a frontmatter `id` pins the edge id, and a markdown link works as an endpoint.

## Endpoints follow notes

Missing endpoints become stubs; creating the notes re-points the edge, deleting one turns it back into a stub, and deleting the edge note releases everything.

## Incomplete edge note

An edge note missing `edgeType` contributes neither edge nor node and reports an `edge-note` diagnostic naming the field.

## Links to edge notes refused

An inline edge to an edge note is dropped with an `edge-note` diagnostic at its line, and comes back when the note turns into an ordinary note and back again.

## Findings in the edge note

A schema finding about an edge declared by an edge note, such as a missing required edge property, is reported at the edge note's path.
