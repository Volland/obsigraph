---
edgeTypes:
  works_at:
    uri: schema:worksFor
    from: Person
    to: Company
    properties:
      role: {kind: text, required: true}
      since: number
    visualization: {color: "#0ea5e9"}
  mentors:
    from: Person
    to: Person
    properties: {since: number}
---
Edge types shared by the whole vault: who works where, and who mentors whom.

This note declares no type of its own. A schema note can hold a single type under `schema:`, several types under `schemas:`, edge types under `edgeTypes:`, or any mix, so one note can describe a whole part of the model.
