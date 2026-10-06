---
tgs: "0.1"
schemas:
  Decision:
    properties:
      status: {values: [proposed, accepted, superseded, rejected], default: proposed}
      date: date
      owner: text
    edges:
      supersedes: Decision
      contradicts: [Decision, Requirement, Constraint]
      motivated_by: [Constraint, Concept, Decision]
      changed_by: Change
    visualization: {color: "#6366f1", shape: hexagon}
  Requirement:
    properties:
      status: {values: [draft, stable, deprecated], default: draft}
      risk: {values: [low, medium, high]}
      owner: text
    edges:
      refines: Requirement
      depends_on: Requirement
      contradicts: [Decision, Requirement, Constraint]
      introduced_by: Change
      changed_by: Change
    visualization: {color: "#0ea5e9", shape: round-rectangle}
  Scenario:
    properties:
      status: {values: [draft, stable, deprecated], default: draft}
    edges:
      refines: Requirement
    visualization: {color: "#14b8a6", shape: round-rectangle}
  Constraint:
    properties:
      source: {kind: text, required: true}
      owner: text
    edges:
      constrains: [Requirement, Decision]
    visualization: {color: "#f59e0b", shape: diamond}
  Concept:
    properties:
      status: {values: [draft, stable, deprecated], default: draft}
    edges:
      defines:
    visualization: {color: "#a855f7", shape: ellipse}
  Change:
    properties:
      status: {values: [proposed, applied, archived], default: proposed}
      date: date
    visualization: {color: "#64748b", shape: tag}
edgeTypes:
  implements:
    from: [CodeSymbol, CodeFile]
    to: [Requirement, Decision]
    properties:
      since: text
      confidence: {values: [full, partial]}
  verifies:
    from: [CodeSymbol, CodeFile]
    to: [Requirement, Scenario]
    properties: {since: text}
  contradicts:
    from: [CodeSymbol, CodeFile, Requirement, Decision]
    to: [Decision, Requirement, Constraint]
    properties:
      until: text
      ticket: text
    visualization: {color: "#e5484d", line: dashed}
  supersedes:
    from: Decision
    to: Decision
  motivated_by:
    from: Decision
    to: [Constraint, Concept, Decision]
  constrains:
    from: Constraint
    to: [Requirement, Decision, CodeSymbol, CodeFile]
  refines:
    from: [Requirement, Scenario]
    to: Requirement
  depends_on:
    from: [Requirement, CodeSymbol]
    to: Requirement
  defines:
    from: Concept
  introduced_by:
    to: Change
  changed_by:
    to: Change
---
# Code Ontology Schema

The Typed Graph Schema (TGS) declaration of the code ontology: six intent types and eleven edge types, readable by the Obsidian plugin, `tg schema` and any TGS or SHACL tool.

The vocabulary and its rules of use are in `lat.md/code-ontology.md`; this note is its machine-readable form, so edit both together. It lives outside `lat.md/` because every note directly in a schema folder declares a type.

## Using it

Export it to RDF tools with `tg schema export shapes.ttl --schema-folder ontology`. In the Obsidian plugin, set the schema folder to `ontology` and open the project as a vault. `CodeSymbol`, `CodeFile` and `Section` are derived by `tg` and need no declaration.

## Changing it

Rename, drop or add types freely: a type earns its place only when a question depends on it. Keep `tgs: "0.1"` so other readers know which version of the format this note is written for.
