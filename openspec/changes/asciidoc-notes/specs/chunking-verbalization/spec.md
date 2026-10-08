## ADDED Requirements

### Requirement: AsciiDoc chunks hold visible text
An `.adoc` note SHALL be chunked at its section headings, with each chunk's heading path equal to the section's canonical heading path. Comments (including `@tg` lines and the leading property block), attribute entries, `include::` lines and block attribute lines SHALL be removed from chunk text; paragraphs, delimited block content and the text of cross references SHALL be kept. Context SHALL be prepended from the document title, labels and merged properties.

#### Scenario: Metadata stripped
- **WHEN** a section holds `// @tg: defines:: [[Metagraph]]`, `:tg-status: draft` and a paragraph
- **THEN** its chunk contains the paragraph and neither the comment nor the attribute

#### Scenario: Cross reference text
- **WHEN** a paragraph contains `xref:ch04.adoc[the next chapter]`
- **THEN** the chunk contains `the next chapter`

#### Scenario: Included files not duplicated
- **WHEN** `book.adoc` includes `ch01.adoc`
- **THEN** the text of `ch01.adoc` appears only in chunks of `ch01.adoc`
