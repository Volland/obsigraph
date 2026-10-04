---
schema:
  properties:
    year: {kind: number, required: true}
    venue: text
    short: text
  edges: [cites, about]
  visualization:
    color: "#3e63dd"
    shape: rectangle
    icon: file-text
    label: short
    edges:
      cites: {line: dashed}
---
## Abstract

One paragraph summary.
