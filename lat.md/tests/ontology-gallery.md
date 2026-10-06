---
lat:
  require-code-mention: true
---
# Ontology Gallery Tests

Test specifications for the downloadable ontologies in `ontologies/` and the rules that let them be combined. See [[publishing#Ontology gallery]].

## Each ontology stands alone

Every ontology in the gallery reads without diagnostics, validates its own example notes, passes the TGS JSON Schema and exports to SHACL, and `core` declares only the shared edge types.

## Ontologies compose

All ontologies placed in one schema folder, with a note labelled by two ontologies at once, produce no diagnostics and the combined type count is the sum of the parts.

## Clash without core

Declaring a shared edge type in a second note is reported as a duplicate declaration, which is why shared edge types live in `core`.

## Mixin bridges two ontologies

A small mixin type that allows an edge to a type from another ontology grants that edge to notes labelled with both types, and the edge is reported as not allowed on notes without the mixin.
