---
tgs: "0.1"
schemas:
  Book:
    properties:
      status: {values: [wishlist, to-read, reading, finished, abandoned], default: to-read}
      format: {values: [paper, ebook, audio]}
      rating: number
      pages: number
      year: number
      isbn: text
      started: date
      finished: date
    edges:
      written_by: {target: Author, required: true}
      in_series: Series
      has_genre: Genre
      sequel_of: Book
      inspired_by: Book
    visualization: {color: "#0ea5e9", shape: round-rectangle, icon: book}
  Author:
    properties:
      born: number
      country: text
    edges:
      influenced: Author
    visualization: {color: "#a855f7", shape: ellipse, icon: user}
  Series:
    properties:
      planned_volumes: number
    visualization: {color: "#14b8a6", shape: hexagon, icon: library}
  Genre:
    visualization: {color: "#f59e0b", shape: tag, icon: tag}
  Quote:
    properties:
      page: number
      saved: date
    edges:
      quoted_from: {target: Book, required: true}
    visualization: {color: "#64748b", shape: rectangle, icon: quote}
edgeTypes:
  written_by: {from: Book, to: Author, properties: {role: {values: [author, translator, editor, illustrator]}}}
  in_series: {from: Book, to: Series, properties: {volume: number}}
  has_genre: {from: Book, to: Genre}
  sequel_of: {from: Book, to: Book}
  inspired_by: {from: Book, to: Book}
  influenced: {from: Author, to: Author}
  quoted_from: {from: Quote, to: Book}
---
The library ontology: books with a reading status, their authors, series and genres, and the quotes you saved from them.

`status` is the shelf a book is on, and `started` and `finished` give you a reading log for free. Series membership carries the volume number on the edge, so one book can belong to several series without a clash.
