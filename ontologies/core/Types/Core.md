---
tgs: "0.1"
edgeTypes:
  contradicts:
    properties:
      why: text
      until: text
      ticket: text
    visualization: {color: "#e5484d", line: dashed}
---
The shared core: edge types that more than one ontology uses, declared once so the ontologies can be combined without a duplicate-declaration clash.

Each ontology says which of its types may use `contradicts`; this note says what the edge is. Add an edge type here when a second ontology starts to need the same word, and drop it from the first.
