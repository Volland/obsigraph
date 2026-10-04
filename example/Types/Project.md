---
schema:
  properties:
    status: {kind: text, default: active}
    started: date
  edges: [depends_on, about]
  visualization:
    color: "#17c3b2"
    shape: diamond
    icon: folder-kanban
    edges:
      depends_on: {color: "#17c3b2", line: dotted}
---
## Goal

What this project delivers.

## Dependencies

Add `depends_on` edge lines here.
