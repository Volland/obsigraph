---
schema:
  properties:
    role: {kind: text, required: true}
    joined: date
    email: text
  edges: [knows, mentors, works_at, leads, contributes, authored, interested_in, trusts, distrusts]
  visualization:
    color: "#7c5cff"
    shape: ellipse
    icon: user
    edges:
      knows: {color: "#f5a524", line: dotted}
      mentors: {color: "#7c5cff"}
---
## About

Who they are and what they work on.

## Links

Add edge lines here, one per line.
