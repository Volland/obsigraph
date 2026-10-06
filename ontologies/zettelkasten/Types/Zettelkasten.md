---
tgs: "0.1"
schemas:
  Zettel:
    properties:
      stage: {values: [fleeting, literature, permanent], default: fleeting}
      confidence: {values: [low, medium, high]}
      created: date
    edges:
      extends: Zettel
      supports: Zettel
      contradicts: Zettel
      example_of: Zettel
      follows: Zettel
      cites: Source
      about: Topic
    visualization:
      color: "#f59e0b"
      shape: round-rectangle
      icon: sticky-note
      edges:
        contradicts: {color: "#e5484d", line: dashed}
  Source:
    properties:
      author: text
      year: number
      kind: {values: [book, article, paper, talk, video, web], default: book}
    visualization: {color: "#64748b", shape: rectangle, icon: book-open}
  Topic:
    properties:
      status: {values: [seed, growing, mature], default: seed}
    edges:
      related_to: Topic
    visualization: {color: "#7c5cff", shape: ellipse, icon: folder}
edgeTypes:
  extends: {from: Zettel, to: Zettel}
  supports: {from: Zettel, to: Zettel, properties: {how: text}}
  example_of: {from: Zettel, to: Zettel}
  follows:
    from: Zettel
    to: Zettel
    properties: {luhmann: text}
    visualization: {color: "#f59e0b", line: dotted}
  cites: {from: Zettel, to: Source, properties: {page: text}}
  about: {from: Zettel, to: Topic}
  related_to: {from: Topic, to: Topic}
---
The Zettelkasten ontology: atomic notes (`Zettel`) that cite `Source`s and live under `Topic`s, linked by how one idea relates to another.

A `stage` property carries the classic workflow: a fleeting note becomes a literature note once it cites a source, and a permanent note once it is rewritten in your own words and linked to at least one other zettel.

`contradicts` is declared once in the shared `core` ontology, so this note only says which zettels may use it and how to draw it. Without `core` the edge still works; it just has no declared properties.
