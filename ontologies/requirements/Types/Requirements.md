---
tgs: "0.1"
schemas:
  Requirement:
    properties:
      status: {values: [draft, stable, deprecated], default: draft}
      priority: {values: [must, should, could, wont], default: should}
      risk: {values: [low, medium, high]}
      owner: text
    edges:
      refines: Requirement
      depends_on: Requirement
      requested_by: Stakeholder
      ships_in: Release
      introduced_by: Change
      changed_by: Change
      contradicts: [Decision, Requirement, Constraint]
    visualization:
      color: "#0ea5e9"
      shape: round-rectangle
      icon: list-checks
      edges:
        contradicts: {color: "#e5484d", line: dashed}
  Scenario:
    properties:
      status: {values: [draft, stable, deprecated], default: draft}
    edges:
      refines: Requirement
    visualization: {color: "#14b8a6", shape: round-rectangle, icon: flask-conical}
  Decision:
    properties:
      status: {values: [proposed, accepted, superseded, rejected], default: proposed}
      date: date
      owner: text
    edges:
      supersedes: Decision
      motivated_by: [Constraint, Concept, Decision]
      contradicts: [Decision, Requirement, Constraint]
      changed_by: Change
    visualization:
      color: "#6366f1"
      shape: hexagon
      icon: scale
      edges:
        contradicts: {color: "#e5484d", line: dashed}
  Constraint:
    properties:
      source: {kind: text, required: true}
      owner: text
    edges:
      constrains: [Requirement, Decision]
    visualization: {color: "#f59e0b", shape: diamond, icon: lock}
  Concept:
    properties:
      status: {values: [draft, stable, deprecated], default: draft}
    edges:
      defines:
    visualization: {color: "#a855f7", shape: ellipse, icon: lightbulb}
  Change:
    properties:
      status: {values: [proposed, applied, archived], default: proposed}
      date: date
    edges:
      ships_in: Release
    visualization: {color: "#64748b", shape: tag, icon: git-pull-request}
  Stakeholder:
    properties:
      role: text
      team: text
    visualization: {color: "#ec4899", shape: ellipse, icon: user}
  Release:
    properties:
      version: {kind: text, required: true}
      date: date
      status: {values: [planned, shipped], default: planned}
    visualization: {color: "#22c55e", shape: tag, icon: rocket}
  Risk:
    properties:
      likelihood: {values: [low, medium, high]}
      impact: {values: [low, medium, high]}
      status: {values: [open, mitigated, accepted, closed], default: open}
    edges:
      threatens: Requirement
      mitigated_by: [Requirement, Decision]
    visualization: {color: "#e5484d", shape: triangle, icon: alert-triangle}
edgeTypes:
  refines: {from: [Requirement, Scenario], to: Requirement}
  depends_on: {from: Requirement, to: Requirement}
  requested_by: {from: Requirement, to: Stakeholder, properties: {since: date}}
  ships_in: {from: [Requirement, Change], to: Release}
  introduced_by: {to: Change}
  changed_by: {to: Change}
  supersedes: {from: Decision, to: Decision}
  motivated_by: {from: Decision, to: [Constraint, Concept, Decision]}
  constrains: {from: Constraint, to: [Requirement, Decision]}
  defines: {from: Concept}
  threatens: {from: Risk, to: Requirement}
  mitigated_by: {from: Risk, to: [Requirement, Decision]}
---
The requirements ontology: the code ontology that `tg init` installs, grown for product work with stakeholders, releases and risks.

Requirements, scenarios, decisions, constraints and concepts keep the meaning they have in the code ontology. Code-to-intent edges (`implements`, `verifies`) are written in source with `@tg:` comments, so they are not declared here.

`contradicts` is declared once in the shared `core` ontology (with `why`, `until` and `ticket`), so this note only says which types may use it and how to draw it.
