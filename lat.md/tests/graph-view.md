---
lat:
  require-code-mention: true
---
# Graph View Tests

Test specifications for the pure view-state logic of the full-pane Graph view described in [[visualization#Surfaces]]; the Obsidian leaf itself is verified manually.

## Neighborhood of active note

The default content is the active note plus its incident edges in both directions and its direct neighbors; an unknown note yields an empty graph.

## Expansion keeps existing elements

Expanding a node merges its neighborhood into the current elements without discarding anything already shown.

## Edge selection details

A selected edge shows its type, sign, ID, source heading and user properties, with negative edges marked.

## Node selection details

A selected node shows its title, labels, stub flag and properties.

## Same element same style

A node produces identical element data, classes and style rules whether it comes from an inline block result or from the Graph view.

## Stubs visible in neighborhood

Stub neighbors appear in the view with no note path, so unresolved links stay visible but cannot be opened.
